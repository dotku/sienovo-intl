import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { indexKnowledgeFile } from "@/lib/rag/index";

export const maxDuration = 300;

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const files = await prisma.knowledgeFile.findMany({
    where: {
      trashedAt: null,
      indexStatus: { in: ["pending", "error"] },
    },
  });

  const results: { id: string; name: string; status: string; error?: string }[] = [];

  for (const file of files) {
    try {
      await indexKnowledgeFile(file.id);
      results.push({ id: file.id, name: file.name, status: "indexed" });
    } catch (err) {
      results.push({
        id: file.id,
        name: file.name,
        status: "error",
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
