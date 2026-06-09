import { NextRequest, NextResponse } from "next/server";
import { prisma, pool } from "@/lib/prisma";
import { embedQuery } from "@/lib/rag/embed";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";

export const maxDuration = 60;

// A canonical query that should always hit Sienovo's product corpus. Used to
// prove the full path end-to-end rather than just pinging the DB.
const PROBE_QUERY = "Sienovo ARM FPGA 工业控制器 product specification";

/**
 * RAG health check — exercises the WHOLE retrieval path so a silent break
 * (embedding model 404, missing pgvector column, empty index) surfaces
 * immediately instead of rotting in indexError fields.
 *
 * Steps: embed a probe query via Bedrock Cohere → pgvector k-NN search →
 * assert non-empty results, plus report index/vector counts. Returns 200 when
 * healthy, 503 when not, so an uptime monitor or the daily report can alert.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (the embedding call costs money).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, unknown> = {};
  let ok = true;

  // 1. Embedding (Bedrock Cohere) — catches model/endpoint/credential failures.
  let queryEmbedding: number[] | null = null;
  try {
    const t = Date.now();
    queryEmbedding = await embedQuery(PROBE_QUERY);
    checks.embedding = {
      ok: queryEmbedding.length > 0,
      dims: queryEmbedding.length,
      ms: Date.now() - t,
    };
    if (!queryEmbedding.length) ok = false;
  } catch (err) {
    ok = false;
    checks.embedding = { ok: false, error: (err as Error).message };
  }

  // 2. Retrieval (pgvector k-NN) — catches a missing embedding column or an
  //    empty/unembedded index.
  try {
    const t = Date.now();
    const results = await retrieveRelevantChunks(PROBE_QUERY, 3, 0.2);
    checks.retrieval = {
      ok: results.length > 0,
      results: results.length,
      topSimilarity: results[0]?.similarity ?? null,
      topSource: results[0]?.sourceName ?? null,
      ms: Date.now() - t,
    };
    if (results.length === 0) ok = false;
  } catch (err) {
    ok = false;
    checks.retrieval = { ok: false, error: (err as Error).message };
  }

  // 3. Store counts — surfaces stuck files and unembedded chunks.
  try {
    const byStatus = await prisma.knowledgeFile.groupBy({
      by: ["indexStatus"],
      where: { trashedAt: null },
      _count: true,
    });
    const status: Record<string, number> = {};
    for (const row of byStatus) status[row.indexStatus] = row._count;

    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS chunks, COUNT(embedding)::int AS embedded FROM "KnowledgeChunk"',
    );
    const { chunks, embedded } = rows[0] as { chunks: number; embedded: number };

    checks.store = { status, chunks, embedded };
    // Any chunk without an embedding means a half-finished index.
    if (chunks !== embedded) ok = false;
  } catch (err) {
    ok = false;
    checks.store = { ok: false, error: (err as Error).message };
  }

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
