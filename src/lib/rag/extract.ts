export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    // pdf-parse v2 API — use dynamic require to avoid type issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require("pdf-parse");
    const parser = new PDFParse(buffer);
    await parser.load();
    const result = await parser.getText();
    parser.destroy();
    return typeof result === "string" ? result : result?.text || "";
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
