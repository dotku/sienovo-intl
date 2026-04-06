import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { indexKnowledgeArticle } from "@/lib/rag/index-article";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const article = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(article);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) {
    data.content = body.content;
    data.indexStatus = "pending"; // re-index needed after content change
  }
  if (body.category !== undefined) data.category = body.category;

  const article = await prisma.knowledgeArticle.update({
    where: { id },
    data,
  });

  // Re-index if content changed
  if (body.content !== undefined && body.reindex !== false) {
    try {
      await indexKnowledgeArticle(id);
    } catch { /* will show as error status */ }
  }

  return NextResponse.json(article);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  // Delete chunks first (cascade should handle it, but be explicit)
  await prisma.knowledgeChunk.deleteMany({ where: { knowledgeArticleId: id } });
  await prisma.knowledgeArticle.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
