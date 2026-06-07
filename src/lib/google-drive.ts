/**
 * Google Drive folder traversal for the knowledge base.
 *
 * Walks a shared folder recursively, following pagination and descending into
 * subfolders, and returns a flat list of downloadable files. Used by the admin
 * sync route and the daily cron alike.
 */

import { prisma } from "@/lib/prisma";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  /** Slash-joined folder names from the root folder, for display/debugging. */
  path: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

// Videos are huge and carry no text for embedding — pulling them into R2 wastes
// storage and risks the serverless function OOMing on a multi-hundred-MB
// arrayBuffer(). Skip them; everything else (docs, sheets, slides, PDFs,
// images) flows through.
function isSkippable(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

async function listChildren(
  token: string,
  folderId: string
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string }>> {
  const out: Array<{ id: string; name: string; mimeType: string; size?: string }> = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,name,mimeType,size)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    out.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

/**
 * Recursively collect all non-folder, non-skippable files under `folderId`.
 * `maxDepth` guards against shortcut/cycle loops.
 */
export async function listFolderFilesRecursive(
  token: string,
  folderId: string,
  { maxDepth = 10 }: { maxDepth?: number } = {}
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  const seenFolders = new Set<string>();

  async function walk(id: string, path: string, depth: number): Promise<void> {
    if (depth > maxDepth || seenFolders.has(id)) return;
    seenFolders.add(id);

    const children = await listChildren(token, id);
    for (const child of children) {
      if (child.mimeType === FOLDER_MIME) {
        await walk(child.id, path ? `${path}/${child.name}` : child.name, depth + 1);
      } else if (!isSkippable(child.mimeType)) {
        files.push({ ...child, path });
      }
    }
  }

  await walk(folderId, "", 0);
  return files;
}

// Google Workspace files (Docs/Sheets/Slides) have no binary form — they must be
// exported. Export straight to text so the extractor gets clean content with no
// PDF round-trip.
const EXPORT_TYPES: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", ext: ".txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: ".csv" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", ext: ".txt" },
};

export type SyncStatus = "synced" | "exists" | "failed";

/**
 * Record a Drive file as a pending KnowledgeFile — metadata only, no download.
 * The bytes are pulled straight from Drive at index time (see downloadDriveFile),
 * so documents are never duplicated into blob storage. Idempotent on driveFileId.
 */
export async function syncDriveFile(df: DriveFile): Promise<SyncStatus> {
  const existing = await prisma.knowledgeFile.findUnique({
    where: { driveFileId: df.id },
  });
  if (existing) return "exists";

  try {
    await prisma.knowledgeFile.create({
      data: {
        name: df.name,
        key: "",
        url: `https://drive.google.com/file/d/${df.id}/view`,
        size: df.size ? parseInt(df.size, 10) || 0 : 0,
        mimeType: df.mimeType,
        driveFileId: df.id,
        source: "google_drive",
      },
    });
    return "synced";
  } catch {
    return "failed";
  }
}

/**
 * Fetch a Drive file's bytes for indexing, exporting Workspace docs to text.
 * Returns the buffer with the effective mime/filename so the extractor knows how
 * to parse it. Throws on a failed download/export so the caller marks it errored.
 */
export async function downloadDriveFile(
  token: string,
  fileId: string,
  mimeType: string,
  fileName: string,
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const exp = EXPORT_TYPES[mimeType];
  if (exp) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exp.mime)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Drive export failed (${res.status})`);
    const name = fileName.endsWith(exp.ext) ? fileName : fileName + exp.ext;
    return { buffer: Buffer.from(await res.arrayBuffer()), mimeType: exp.mime, fileName: name };
  }
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType, fileName };
}
