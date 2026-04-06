import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { indexKnowledgeFile } from "@/lib/rag/index";

export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { fileId } = await params;

  try {
    await indexKnowledgeFile(fileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Indexing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
