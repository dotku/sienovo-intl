import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { getDriveAccessToken } from "@/lib/google-drive-token";
import { listFolderFilesRecursive, syncDriveFile, type DriveFile } from "@/lib/google-drive";

// Extract folder ID from Google Drive URL
function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { folderUrl } = body as { folderUrl: string };

  const folderId = extractFolderId(folderUrl || "");
  if (!folderId) {
    return NextResponse.json({ error: "Invalid Google Drive folder URL" }, { status: 400 });
  }

  // Service account (durable) first, user OAuth as fallback.
  const auth = await getDriveAccessToken();
  if (!auth) {
    return NextResponse.json(
      { error: "reauth", redirectUrl: "/api/admin/google/authorize?returnTo=/admin/system/knowledge" },
      { status: 401 }
    );
  }
  const accessToken = auth.token;

  // Walk the folder tree (paginated, recursing into subfolders).
  let driveFiles: DriveFile[];
  try {
    driveFiles = await listFolderFilesRecursive(accessToken, folderId);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to list Drive folder: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  if (driveFiles.length === 0) {
    return NextResponse.json({ synced: 0, skipped: 0, total: 0, message: "No files found in folder." });
  }

  // Stream progress via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let synced = 0;
      let skipped = 0;
      const total = driveFiles.length;

      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", total, tokenSource: auth.source });

      for (let i = 0; i < driveFiles.length; i++) {
        const df = driveFiles[i];
        send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status: "downloading" });

        const status = await syncDriveFile(df);
        if (status === "synced") synced++;
        else skipped++;

        send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status });
      }

      send({ type: "done", synced, skipped, total });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
