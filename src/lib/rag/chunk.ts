export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
}

// Sizing is in characters, not estimated tokens: Cohere (Bedrock) enforces a
// hard 2048-char-per-text limit, and the old chars/4 token estimate badly
// under-counts CJK, so token-sized chunks blew past it. Pack to ~TARGET and
// never exceed MAX (< 2048 for headroom).
const TARGET_CHUNK_CHARS = 1200;
const MAX_CHUNK_CHARS = 1800;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Split into sentences on both Latin (.!?) and CJK (。！？；) terminators,
// keeping the terminator with its sentence. Falls back to the whole string when
// there's no punctuation to split on.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？；;])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Break text into sentence-sized units, none longer than MAX_CHUNK_CHARS. Only a
// single sentence with no internal break (e.g. a long table row) hits the
// character hard-split — the rare last resort, not the normal path.
function toUnits(text: string): string[] {
  const units: string[] = [];
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    if (para.length <= MAX_CHUNK_CHARS) {
      units.push(para);
      continue;
    }
    for (const sentence of splitSentences(para)) {
      if (sentence.length <= MAX_CHUNK_CHARS) {
        units.push(sentence);
      } else {
        for (let i = 0; i < sentence.length; i += MAX_CHUNK_CHARS) {
          units.push(sentence.slice(i, i + MAX_CHUNK_CHARS));
        }
      }
    }
  }
  return units;
}

export function chunkText(text: string): Chunk[] {
  const units = toUnits(text);

  // Greedily pack whole sentences/paragraphs up to the target size so chunk
  // boundaries fall on natural sentence breaks.
  const chunks: Chunk[] = [];
  let current = "";
  let idx = 0;

  const flush = () => {
    const content = current.trim();
    if (content) {
      chunks.push({ content, index: idx++, tokenCount: estimateTokens(content) });
    }
    current = "";
  };

  for (const unit of units) {
    if (current && current.length + 1 + unit.length > TARGET_CHUNK_CHARS) {
      flush();
    }
    current += (current ? "\n" : "") + unit;
  }
  flush();

  return chunks;
}
