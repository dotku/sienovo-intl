/**
 * Google Drive folder traversal for the knowledge base.
 *
 * Walks a shared folder recursively, following pagination and descending into
 * subfolders, and returns a flat list of downloadable files. Used by the admin
 * sync route and the daily cron alike.
 */

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
