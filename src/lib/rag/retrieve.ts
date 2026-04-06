import { pool } from "@/lib/prisma";
import { embedQuery } from "./embed";

export interface RetrievedChunk {
  id: string;
  content: string;
  fileName: string;
  similarity: number;
}

export async function retrieveRelevantChunks(
  query: string,
  topK: number = 5,
  similarityThreshold: number = 0.3
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const result = await pool.query(
    `SELECT
       kc.id,
       kc.content,
       kf.name AS "fileName",
       1 - (kc.embedding <=> $1::vector) AS similarity
     FROM "KnowledgeChunk" kc
     JOIN "KnowledgeFile" kf ON kf.id = kc."knowledgeFileId"
     WHERE kf."trashedAt" IS NULL
       AND kf."indexStatus" = 'indexed'
       AND kc.embedding IS NOT NULL
     ORDER BY kc.embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, topK]
  );

  return result.rows
    .filter((row: { similarity: number }) => row.similarity >= similarityThreshold)
    .map((row: { id: string; content: string; fileName: string; similarity: number }) => ({
      id: row.id,
      content: row.content,
      fileName: row.fileName,
      similarity: row.similarity,
    }));
}
