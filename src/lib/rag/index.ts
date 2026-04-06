import { prisma, pool } from "@/lib/prisma";
import { extractText } from "./extract";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";
import { trackApiUsage } from "@/lib/api-usage";

export async function indexKnowledgeFile(fileId: string): Promise<void> {
  const file = await prisma.knowledgeFile.update({
    where: { id: fileId },
    data: { indexStatus: "processing", indexError: null },
  });

  try {
    // 1. Download from R2
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2. Extract text
    const text = await extractText(buffer, file.mimeType, file.name);
    if (!text.trim()) throw new Error("No text extracted from file");

    // 3. Chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No chunks generated");

    // 4. Generate embeddings
    const embeddings = await embedTexts(chunks.map((c) => c.content));
    await trackApiUsage("gemini", "embed", true);

    // 5. Delete old chunks (for re-indexing)
    await pool.query(
      'DELETE FROM "KnowledgeChunk" WHERE "knowledgeFileId" = $1',
      [fileId]
    );

    // 6. Insert chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      // Create chunk via Prisma (gets proper cuid)
      const dbChunk = await prisma.knowledgeChunk.create({
        data: {
          knowledgeFileId: fileId,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: chunk.tokenCount,
        },
      });

      // Set embedding via raw SQL
      await pool.query(
        'UPDATE "KnowledgeChunk" SET embedding = $1 WHERE id = $2',
        [`[${embedding.join(",")}]`, dbChunk.id]
      );
    }

    // 7. Mark as indexed
    await prisma.knowledgeFile.update({
      where: { id: fileId },
      data: { indexStatus: "indexed", indexedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.knowledgeFile.update({
      where: { id: fileId },
      data: { indexStatus: "error", indexError: message },
    });
    throw err;
  }
}
