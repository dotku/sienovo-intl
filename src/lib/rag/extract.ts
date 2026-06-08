import { isAltiumCad, extractCadText } from "./cad-extract";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  // Altium binary CAD (.PcbDoc/.SchDoc) — no prose, but the streams carry IC
  // part numbers, interfaces and nets. Mine them and narrate via Bedrock.
  if (isAltiumCad(fileName)) {
    return await extractCadText(buffer, fileName);
  }

  // PDF — unpdf bundles a serverless build of pdf.js that works in Node
  // without a DOM (the old pdf-parse path threw "DOMMatrix is not defined").
  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfExtract(pdf, { mergePages: true });
    return text;
  }

  // Word (.docx)
  if (mimeType === DOCX_MIME || fileName.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  // CSV, plain text, markdown, etc.
  if (
    mimeType.startsWith("text/") ||
    fileName.endsWith(".csv") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".txt")
  ) {
    return buffer.toString("utf-8");
  }

  // JSON
  if (mimeType === "application/json" || fileName.endsWith(".json")) {
    return buffer.toString("utf-8");
  }

  return "";
}
