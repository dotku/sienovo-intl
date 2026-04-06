import { prisma, pool } from "@/lib/prisma";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";
import { trackApiUsage } from "@/lib/api-usage";

export async function indexKnowledgeArticle(articleId: string): Promise<void> {
  const article = await prisma.knowledgeArticle.update({
    where: { id: articleId },
    data: { indexStatus: "processing", indexError: null },
  });

  try {
    const text = `${article.title}\n\n${article.content}`;
    if (!text.trim()) throw new Error("Empty article content");

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No chunks generated");

    const embeddings = await embedTexts(chunks.map((c) => c.content));
    await trackApiUsage("gemini", "embed_article", true);

    // Delete old chunks
    await pool.query(
      'DELETE FROM "KnowledgeChunk" WHERE "knowledgeArticleId" = $1',
      [articleId]
    );

    // Insert new chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      const dbChunk = await prisma.knowledgeChunk.create({
        data: {
          knowledgeArticleId: articleId,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: chunk.tokenCount,
        },
      });

      await pool.query(
        'UPDATE "KnowledgeChunk" SET embedding = $1 WHERE id = $2',
        [`[${embedding.join(",")}]`, dbChunk.id]
      );
    }

    await prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: { indexStatus: "indexed", indexedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: { indexStatus: "error", indexError: message },
    });
    throw err;
  }
}
