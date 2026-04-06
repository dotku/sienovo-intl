import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { uploadFile } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const files = await prisma.companyFile.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  // Verify company exists
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string) || "other";
  const notes = (formData.get("notes") as string) || null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `companies/${id}/${Date.now()}-${file.name}`;
  const url = await uploadFile(buffer, key, file.type);

  const record = await prisma.companyFile.create({
    data: {
      name: file.name,
      key,
      url,
      size: file.size,
      mimeType: file.type,
      category,
      notes,
      companyId: id,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
