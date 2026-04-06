export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
}

const TARGET_CHUNK_SIZE = 600;
const MAX_CHUNK_SIZE = 1000;
const OVERLAP_WORDS = 25;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(text: string): Chunk[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: Chunk[] = [];
  let current = "";
  let idx = 0;

  const flush = () => {
    if (current.trim()) {
      chunks.push({
        content: current.trim(),
        index: idx++,
        tokenCount: estimateTokens(current),
      });
      // Keep overlap
      const words = current.split(/\s+/);
      current = words.slice(-OVERLAP_WORDS).join(" ");
    }
  };

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // Large paragraph — split by sentences
    if (paraTokens > MAX_CHUNK_SIZE) {
      flush();
      const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
      for (const sentence of sentences) {
        if (
          estimateTokens(current + " " + sentence) > TARGET_CHUNK_SIZE &&
          current
        ) {
          flush();
        }
        current += (current ? " " : "") + sentence;
      }
      continue;
    }

    // Would exceed target — flush first
    if (
      estimateTokens(current + "\n\n" + para) > TARGET_CHUNK_SIZE &&
      current
    ) {
      flush();
    }

    current += (current ? "\n\n" : "") + para;
  }

  // Final chunk
  if (current.trim()) {
    chunks.push({
      content: current.trim(),
      index: idx,
      tokenCount: estimateTokens(current),
    });
  }

  return chunks;
}
