import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDriveServiceToken } from "@/lib/google-drive-token";
import { listFolderFilesRecursive, syncDriveFile } from "@/lib/google-drive";
import { indexKnowledgeFile } from "@/lib/rag/index";

export const maxDuration = 300;

// Index at most this many files per run so we stay within maxDuration. Leftovers
// roll to the next run since indexing only ever touches pending/error files.
const INDEX_BATCH = 50;

/**
 * Daily knowledge-base refresh, driven by Vercel Cron.
 *
 * Pulls new files from the configured Google Drive folder via the durable
 * service account (no human re-auth), then embeds any still-pending files into
 * the pgvector store. Idempotent and resumable: already-synced files are
 * skipped and indexing is batched, so partial runs converge over subsequent
 * days.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * when CRON_SECRET is set in the project env.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Folder: explicit env override, else the folder saved via the admin "watch"
  // UI (drive_watch_folder_id setting). May be absent — we still index any
  // already-synced pending files below, so the cron is useful before a folder
  // is configured.
  let folderId = process.env.DRIVE_KNOWLEDGE_FOLDER_ID || null;
  if (!folderId) {
    const saved = await prisma.setting.findUnique({
      where: { key: "drive_watch_folder_id" },
    });
    folderId = saved?.value || null;
  }

  // 1. Sync new files from Drive → R2 + KnowledgeFile (when a folder is set).
  let seen = 0, synced = 0, skipped = 0, failed = 0;
  if (folderId) {
    // Cron is unattended — service account only, never the interactive OAuth path.
    const token = await getDriveServiceToken();
    if (!token) {
      return NextResponse.json(
        { error: "Service account not configured (GA_SERVICE_ACCOUNT_KEY)" },
        { status: 500 }
      );
    }
    try {
      const files = await listFolderFilesRecursive(token, folderId);
      seen = files.length;
      for (const df of files) {
        const status = await syncDriveFile(token, df);
        if (status === "synced") synced++;
        else if (status === "exists") skipped++;
        else failed++;
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Drive list failed: ${(err as Error).message}` },
        { status: 502 }
      );
    }
  }

  // 2. Embed still-pending files into the vector store (bounded batch).
  const pending = await prisma.knowledgeFile.findMany({
    where: { trashedAt: null, indexStatus: { in: ["pending", "error"] } },
    take: INDEX_BATCH,
  });

  let indexed = 0, indexErrors = 0;
  for (const file of pending) {
    try {
      await indexKnowledgeFile(file.id);
      indexed++;
    } catch {
      indexErrors++;
    }
  }

  const remaining = await prisma.knowledgeFile.count({
    where: { trashedAt: null, indexStatus: { in: ["pending", "error"] } },
  });

  return NextResponse.json({
    folderId,
    seen,
    synced,
    skipped,
    failed,
    indexed,
    indexErrors,
    pendingRemaining: remaining,
  });
}
