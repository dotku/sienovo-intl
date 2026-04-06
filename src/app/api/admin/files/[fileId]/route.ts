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
  const file = await prisma.companyFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from R2
  try {
    await deleteFile(file.key);
  } catch {
    // Continue even if R2 delete fails
  }

  // Delete from DB
  await prisma.companyFile.delete({ where: { id: fileId } });

  return NextResponse.json({ ok: true });
}
