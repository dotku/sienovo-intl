import { bedrockEmbed, BEDROCK_EMBED_BATCH } from "@/lib/bedrock";

/**
 * Embed corpus chunks for indexing. Batches to Cohere's per-call limit and
 * tags them as documents (asymmetric retrieval). Returns one 1024-d vector
 * per input text, in order.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += BEDROCK_EMBED_BATCH) {
    const batch = texts.slice(i, i + BEDROCK_EMBED_BATCH);
    embeddings.push(...(await bedrockEmbed(batch, "search_document")));
  }
  return embeddings;
}

/** Embed a single user query (tagged as a query for asymmetric retrieval). */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await bedrockEmbed([text], "search_query");
  return embedding;
}
