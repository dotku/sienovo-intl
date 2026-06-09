import { prisma, pool } from "@/lib/prisma";
import { extractText } from "./extract";
import { chunkText } from "./chunk";
import { embedTexts } from "./embed";
import { trackApiUsage } from "@/lib/api-usage";
import { getDriveServiceToken } from "@/lib/google-drive-token";
import { downloadDriveFile } from "@/lib/google-drive";
import { parseWithLlama, isLlamaParseable, llamaParseConfigured } from "./llamaparse";

export async function indexKnowledgeFile(fileId: string): Promise<void> {
  const file = await prisma.knowledgeFile.update({
    where: { id: fileId },
    data: { indexStatus: "processing", indexError: null },
  });

  try {
    // 1. Get the file bytes — straight from Drive for synced files (no blob
    //    duplication), or from R2 for direct uploads.
    let buffer: Buffer;
    let mimeType = file.mimeType;
    let fileName = file.name;
    if (file.source === "google_drive" && file.driveFileId) {
      const token = await getDriveServiceToken();
      if (!token) throw new Error("Drive service account not configured");
      const dl = await downloadDriveFile(token, file.driveFileId, file.mimeType, file.name);
      buffer = dl.buffer;
      mimeType = dl.mimeType;
      fileName = dl.fileName;
    } else {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    }

    // 2. Extract text — free local extractors first (unpdf/mammoth/text), then
    //    LlamaParse for what they can't handle (spreadsheets, legacy .doc,
    //    images via OCR, scanned PDFs). LlamaParse throwing falls through to the
    //    catch as a retryable "error".
    let text = await extractText(buffer, mimeType, fileName);
    if (!text.trim() && llamaParseConfigured() && isLlamaParseable(mimeType, fileName)) {
      text = await parseWithLlama(buffer, fileName, mimeType);
    }
    if (!text.trim()) {
      // No extractable text (archive, shortcut, blank image, or LlamaParse
      // returned nothing) — terminal, so the cron stops retrying it.
      await prisma.knowledgeFile.update({
        where: { id: fileId },
        data: { indexStatus: "unsupported", indexError: "No extractable text" },
      });
      return;
    }

    // 3. Chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No chunks generated");

    // 4. Generate embeddings
    const embeddings = await embedTexts(chunks.map((c) => c.content));
    await trackApiUsage("gemini", "embed", true);

    // 5. Delete old chunks (for re-indexing)
    await pool.query(
      'DELETE FROM "KnowledgeChunk" WHERE "knowledgeFileId" = $1',
      [fileId]
    );

    // 6. Insert chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      // Create chunk via Prisma (gets proper cuid)
      const dbChunk = await prisma.knowledgeChunk.create({
        data: {
          knowledgeFileId: fileId,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: chunk.tokenCount,
        },
      });

      // Set embedding via raw SQL
      await pool.query(
        'UPDATE "KnowledgeChunk" SET embedding = $1 WHERE id = $2',
        [`[${embedding.join(",")}]`, dbChunk.id]
      );
    }

    // 7. Mark as indexed
    await prisma.knowledgeFile.update({
      where: { id: fileId },
      data: { indexStatus: "indexed", indexedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.knowledgeFile.update({
      where: { id: fileId },
      data: { indexStatus: "error", indexError: message },
    });
    throw err;
  }
}
