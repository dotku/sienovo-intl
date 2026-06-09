/**
 * Archive (.zip) extraction. Altium project zips (and similar) bundle a readable
 * PDF/doc export alongside binary CAD — the readable files carry the real
 * content, and the entry filenames themselves are descriptive (e.g.
 * "21-Ethernet_RTL8370MBI.SchDoc"). We list the manifest and extract text from
 * the readable entries, skipping per-file binary CAD analysis (the bundled PDF
 * already covers the design, and 25 Bedrock calls per zip would be wasteful).
 */

import { unzipSync } from "fflate";

// Entries we pull text from. Binary CAD (.pcbdoc/.schdoc), images, nested zips
// etc. are listed in the manifest but not individually parsed here.
const READABLE = /\.(pdf|docx?|csv|txt|md|json)$/i;
const MAX_OUTPUT = 200_000;

const basename = (p: string) => p.split("/").pop() || p;

/**
 * `extractEntry` is injected (the caller passes `extractText`) to avoid a
 * circular import. It's only invoked for READABLE entries, so a .zip never
 * recurses into itself and binary CAD files don't trigger per-file LLM calls.
 */
export async function extractZipText(
  buffer: Buffer,
  zipName: string,
  extractEntry: (buf: Buffer, mimeType: string, fileName: string) => Promise<string>,
): Promise<string> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    return "";
  }

  const names = Object.keys(files).filter((n) => !n.endsWith("/"));
  const parts: string[] = [
    `# Archive: ${zipName}`,
    "",
    `## Contents (${names.length} files)`,
    ...names.map((n) => `- ${basename(n)}`),
  ];

  for (const name of names) {
    if (!READABLE.test(name)) continue;
    try {
      const text = await extractEntry(Buffer.from(files[name]), "", basename(name));
      if (text.trim()) parts.push(`\n## ${basename(name)}\n${text}`);
    } catch {
      // skip an unreadable entry
    }
    if (parts.reduce((a, p) => a + p.length, 0) > MAX_OUTPUT) break;
  }

  return parts.join("\n").slice(0, MAX_OUTPUT);
}

export function isZip(mimeType: string, fileName: string): boolean {
  return mimeType === "application/zip" || /\.zip$/i.test(fileName);
}
