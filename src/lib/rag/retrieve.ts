import { pool } from "@/lib/prisma";
import { embedQuery } from "./embed";

export interface RetrievedChunk {
  id: string;
  content: string;
  sourceName: string;
  sourceType: "file" | "article";
  similarity: number;
}

export async function retrieveRelevantChunks(
  query: string,
  topK: number = 5,
  similarityThreshold: number = 0.3
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Search both files and articles in one query
  const result = await pool.query(
    `SELECT
       kc.id,
       kc.content,
       COALESCE(kf.name, ka.title, 'Unknown') AS "sourceName",
       CASE
         WHEN kc."knowledgeFileId" IS NOT NULL THEN 'file'
         ELSE 'article'
       END AS "sourceType",
       1 - (kc.embedding <=> $1::vector) AS similarity
     FROM "KnowledgeChunk" kc
     LEFT JOIN "KnowledgeFile" kf ON kf.id = kc."knowledgeFileId"
       AND kf."trashedAt" IS NULL AND kf."indexStatus" = 'indexed'
     LEFT JOIN "KnowledgeArticle" ka ON ka.id = kc."knowledgeArticleId"
       AND ka."indexStatus" = 'indexed'
     WHERE kc.embedding IS NOT NULL
       AND (kf.id IS NOT NULL OR ka.id IS NOT NULL)
     ORDER BY kc.embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, topK]
  );

  return result.rows
    .filter((row: { similarity: number }) => row.similarity >= similarityThreshold)
    .map((row: { id: string; content: string; sourceName: string; sourceType: string; similarity: number }) => ({
      id: row.id,
      content: row.content,
      sourceName: row.sourceName,
      sourceType: row.sourceType as "file" | "article",
      similarity: row.similarity,
    }));
}
