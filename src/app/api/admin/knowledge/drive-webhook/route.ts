import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGoogleAccessToken } from "@/lib/google-token";
import { uploadFile } from "@/lib/r2";

const EXPORT_TYPES: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: ".csv" },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: ".pdf" },
};

// Google Drive sends a POST when files change in the watched folder
export async function POST(req: NextRequest) {
  // Verify this is from Google (channel ID header)
  const channelId = req.headers.get("x-goog-channel-id");
  const storedChannel = await prisma.setting.findUnique({
    where: { key: "drive_watch_channel_id" },
  });

  if (!storedChannel || storedChannel.value !== channelId) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 403 });
  }

  // Ignore sync verification pings
  const state = req.headers.get("x-goog-resource-state");
  if (state === "sync") {
    return NextResponse.json({ ok: true });
  }

  // Run the full folder sync
  await syncFolder();

  return NextResponse.json({ ok: true });
}

async function syncFolder() {
  const folderIdSetting = await prisma.setting.findUnique({
    where: { key: "drive_watch_folder_id" },
  });
  if (!folderIdSetting) return;

  const folderId = folderIdSetting.value;
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return;

  // List all files currently in the Drive folder
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) return;

  const { files: driveFiles = [] } = await listRes.json();
  const driveFileIds = new Set(
    driveFiles.map((f: { id: string }) => f.id)
  );

  // Get existing synced files from our DB
  const existingFiles = await prisma.knowledgeFile.findMany({
    where: { source: "google_drive", driveFileId: { not: null } },
  });

  // Soft-delete files that were removed from Drive (move to trash)
  for (const existing of existingFiles) {
    if (existing.driveFileId && !driveFileIds.has(existing.driveFileId) && !existing.trashedAt) {
      await prisma.knowledgeFile.update({
        where: { id: existing.id },
        data: { trashedAt: new Date() },
      });
    }
  }

  // Permanently delete files trashed more than 30 days ago
  await prisma.knowledgeFile.deleteMany({
    where: {
      trashedAt: {
        not: null,
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  // Add new files that don't exist in our DB
  const existingDriveIds = new Set(
    existingFiles.map((f) => f.driveFileId).filter(Boolean)
  );

  for (const df of driveFiles) {
    if (existingDriveIds.has(df.id)) continue;

    try {
      let fileBuffer: Buffer;
      let fileName = df.name;
      let mimeType = df.mimeType;

      if (df.mimeType === "application/vnd.google-apps.folder") continue;

      const exportType = EXPORT_TYPES[df.mimeType];
      if (exportType) {
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${df.id}/export?mimeType=${encodeURIComponent(exportType.mime)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!exportRes.ok) continue;
        fileBuffer = Buffer.from(await exportRes.arrayBuffer());
        mimeType = exportType.mime;
        if (!fileName.endsWith(exportType.ext)) fileName += exportType.ext;
      } else {
        const dlRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${df.id}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!dlRes.ok) continue;
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
    } catch {
      // Skip failed files
    }
  }
}
