import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { uploadFile } from "@/lib/r2";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `knowledge/${Date.now()}-${file.name}`;
  const url = await uploadFile(buffer, key, file.type);

  const record = await prisma.knowledgeFile.create({
    data: {
      name: file.name,
      key,
      url,
      size: file.size,
      mimeType: file.type,
      source: "upload",
    },
  });

  return NextResponse.json(record, { status: 201 });
}
