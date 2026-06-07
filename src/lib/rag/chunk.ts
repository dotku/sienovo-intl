export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
}

const TARGET_CHUNK_SIZE = 600;
const MAX_CHUNK_SIZE = 1000;
const OVERLAP_WORDS = 25;

// Cohere (Bedrock) rejects any single text over 2048 chars before truncation.
// The token estimate (chars/4) badly under-counts CJK text, so a "600-token"
// chunk can be ~2400 chars. Hard-cap chunk length in characters to stay safe.
const MAX_CHUNK_CHARS = 1800;

// Guarantee no chunk exceeds MAX_CHUNK_CHARS by slicing over-long ones, then
// renumber. Belt-and-suspenders with the embed-layer truncation.
function enforceCharLimit(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  let idx = 0;
  for (const c of chunks) {
    if (c.content.length <= MAX_CHUNK_CHARS) {
      out.push({ ...c, index: idx++ });
      continue;
    }
    for (let i = 0; i < c.content.length; i += MAX_CHUNK_CHARS) {
      const slice = c.content.slice(i, i + MAX_CHUNK_CHARS).trim();
      if (slice) out.push({ content: slice, index: idx++, tokenCount: estimateTokens(slice) });
    }
  }
  return out;
}

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

  return enforceCharLimit(chunks);
}
