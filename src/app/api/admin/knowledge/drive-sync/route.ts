import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { getGoogleAccessToken } from "@/lib/google-token";
import { uploadFile } from "@/lib/r2";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
}

// Extract folder ID from Google Drive URL
function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Google Docs export MIME types
const EXPORT_TYPES: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: ".csv" },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" },
};

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

  let accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "reauth", redirectUrl: "/api/admin/google/authorize?returnTo=/admin/system/knowledge" },
      { status: 401 }
    );
  }

  // List files in folder
  const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size)&pageSize=100`;
  let listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // If token failed, force refresh and retry once
  if (listRes.status === 401 || listRes.status === 403) {
    // Clear cached token to force refresh
    await prisma.setting.update({
      where: { key: "google_access_token" },
      data: { updatedAt: new Date(0) },
    }).catch(() => {});

    accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: "reauth", redirectUrl: "/api/admin/google/authorize?returnTo=/admin/system/knowledge" },
        { status: 401 }
      );
    }

    listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  if (!listRes.ok) {
    if (listRes.status === 401 || listRes.status === 403) {
      return NextResponse.json(
        { error: "reauth", redirectUrl: "/api/admin/google/authorize?returnTo=/admin/system/knowledge" },
        { status: 401 }
      );
    }
    const err = await listRes.text();
    return NextResponse.json(
      { error: `Failed to list Drive folder: ${err}` },
      { status: 502 }
    );
  }

  const listData = await listRes.json();
  const driveFiles: DriveFile[] = listData.files || [];

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

      send({ type: "start", total });

      for (let i = 0; i < driveFiles.length; i++) {
        const df = driveFiles[i];

        // Skip folders
        if (df.mimeType === "application/vnd.google-apps.folder") {
          skipped++;
          send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status: "skipped" });
          continue;
        }

        // Check if already synced
        const existing = await prisma.knowledgeFile.findUnique({
          where: { driveFileId: df.id },
        });
        if (existing) {
          skipped++;
          send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status: "exists" });
          continue;
        }

        try {
          send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status: "downloading" });

          let fileBuffer: Buffer;
          let fileName = df.name;
          let mimeType = df.mimeType;

          const exportType = EXPORT_TYPES[df.mimeType];
          if (exportType) {
            const exportRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${df.id}/export?mimeType=${encodeURIComponent(exportType.mime)}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!exportRes.ok) { skipped++; send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status: "failed" }); continue; }
            fileBuffer = Buffer.from(await exportRes.arrayBuffer());
            mimeType = exportType.mime;
            if (!fileName.endsWith(exportType.ext)) fileName += exportType.ext;
          } else {
            const dlRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${df.id}?alt=media`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!dlRes.ok) { skipped++; send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status: "failed" }); continue; }
            fileBuffer = Buffer.from(await dlRes.arrayBuffer());
          }

          const key = `knowledge/${Date.now()}-${fileName}`;
          const url = await uploadFile(fileBuffer, key, mimeType);

          await prisma.knowledgeFile.create({
            data: {
              name: fileName,
              key,
              url,
              size: fileBuffer.length,
              mimeType,
              driveFileId: df.id,
              source: "google_drive",
            },
          });

          synced++;
          send({ type: "progress", current: i + 1, total, synced, skipped, file: fileName, status: "synced" });
        } catch {
          skipped++;
          send({ type: "progress", current: i + 1, total, synced, skipped, file: df.name, status: "failed" });
        }
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
