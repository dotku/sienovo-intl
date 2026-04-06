import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const files = await prisma.knowledgeFile.findMany({
    where: { trashedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}
