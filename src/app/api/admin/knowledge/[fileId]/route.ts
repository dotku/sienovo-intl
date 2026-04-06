import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { deleteFile } from "@/lib/r2";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { fileId } = await params;
  const file = await prisma.knowledgeFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete — move to trash (auto-deleted after 30 days)
  await prisma.knowledgeFile.update({
    where: { id: fileId },
    data: { trashedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
