import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { uploadFile, deleteFile } from "@/lib/r2";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  // Delete old image from R2 if exists
  if (product.imageKey) {
    await deleteFile(product.imageKey).catch(() => {});
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `products/${id}/${Date.now()}-${file.name}`;
  const url = await uploadFile(buffer, key, file.type);

  const updated = await prisma.product.update({
    where: { id },
    data: { image: url, imageKey: key },
  });

  return NextResponse.json({ image: updated.image, imageKey: updated.imageKey });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (product.imageKey) {
    await deleteFile(product.imageKey).catch(() => {});
  }

  await prisma.product.update({
    where: { id },
    data: { image: null, imageKey: null },
  });

  return NextResponse.json({ success: true });
}
