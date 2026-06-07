/**
 * LlamaParse (LlamaCloud) document parsing — the fallback for formats the free
 * local extractors can't handle: spreadsheets, legacy .doc, images (OCR) and
 * scanned/image-only PDFs. Returns clean markdown.
 *
 * Local unpdf/mammoth handle text PDFs and .docx for free; LlamaParse is only
 * invoked when those yield nothing, so we spend credits only on the hard files.
 * Free tier (10k credits) covers our volume. Configured via LLAMA_INDEX_API_KEY.
 */

const BASE = "https://api.cloud.llamaindex.ai/api/v1/parsing";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 45; // ~90s ceiling per file

// Formats worth sending to LlamaParse. Excludes archives/shortcuts/unknown
// blobs that carry no parseable document.
export function isLlamaParseable(mimeType: string, fileName: string): boolean {
  const n = fileName.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("wordprocessing") ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("presentation") ||
    mimeType === "application/vnd.ms-powerpoint" ||
    /\.(pdf|png|jpe?g|webp|tiff?|xlsx?|docx?|pptx?|csv)$/.test(n)
  );
}

export function llamaParseConfigured(): boolean {
  return Boolean(process.env.LLAMA_INDEX_API_KEY);
}

export async function parseWithLlama(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const apiKey = process.env.LLAMA_INDEX_API_KEY;
  if (!apiKey) throw new Error("LLAMA_INDEX_API_KEY not configured");
  const auth = { Authorization: `Bearer ${apiKey}` };

  // 1. Upload
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  const upRes = await fetch(`${BASE}/upload`, { method: "POST", headers: auth, body: form });
  if (!upRes.ok) {
    throw new Error(`LlamaParse upload failed (${upRes.status}): ${await upRes.text()}`);
  }
  const { id } = (await upRes.json()) as { id: string };

  // 2. Poll until done
  let status = "PENDING";
  for (let i = 0; i < MAX_POLLS && status !== "SUCCESS" && status !== "ERROR"; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const sRes = await fetch(`${BASE}/job/${id}`, { headers: auth });
    if (!sRes.ok) continue;
    status = ((await sRes.json()) as { status: string }).status;
  }
  if (status !== "SUCCESS") {
    throw new Error(`LlamaParse job ${id} ended in status ${status}`);
  }

  // 3. Fetch markdown
  const rRes = await fetch(`${BASE}/job/${id}/result/markdown`, { headers: auth });
  if (!rRes.ok) {
    throw new Error(`LlamaParse result fetch failed (${rRes.status})`);
  }
  const { markdown } = (await rRes.json()) as { markdown: string };
  return markdown || "";
}
