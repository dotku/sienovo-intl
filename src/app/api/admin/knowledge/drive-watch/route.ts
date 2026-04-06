import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { getGoogleAccessToken } from "@/lib/google-token";
import crypto from "crypto";

// POST: Start watching a Drive folder for changes
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { folderUrl } = body as { folderUrl: string };

  const folderId = folderUrl?.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!folderId) {
    return NextResponse.json({ error: "Invalid folder URL" }, { status: 400 });
  }

  // Save the watched folder
  await prisma.setting.upsert({
    where: { key: "drive_watch_folder_id" },
    update: { value: folderId },
    create: { key: "drive_watch_folder_id", value: folderId },
  });
  await prisma.setting.upsert({
    where: { key: "drive_watch_folder_url" },
    update: { value: folderUrl },
    create: { key: "drive_watch_folder_url", value: folderUrl },
  });

  // Register webhook with Google Drive
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google not connected" },
      { status: 401 }
    );
  }

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const channelId = crypto.randomUUID();

  // Get a start page token for tracking changes
  const startTokenRes = await fetch(
    "https://www.googleapis.com/drive/v3/changes/startPageToken",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (startTokenRes.ok) {
    const { startPageToken } = await startTokenRes.json();
    await prisma.setting.upsert({
      where: { key: "drive_change_token" },
      update: { value: startPageToken },
      create: { key: "drive_change_token", value: startPageToken },
    });
  }

  // Register push notification channel
  const watchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: `${baseUrl}/api/admin/knowledge/drive-webhook`,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }),
    }
  );

  if (watchRes.ok) {
    const watchData = await watchRes.json();
    await prisma.setting.upsert({
      where: { key: "drive_watch_channel_id" },
      update: { value: watchData.id },
      create: { key: "drive_watch_channel_id", value: watchData.id },
    });
    await prisma.setting.upsert({
      where: { key: "drive_watch_resource_id" },
      update: { value: watchData.resourceId },
      create: { key: "drive_watch_resource_id", value: watchData.resourceId },
    });
  }

  return NextResponse.json({
    success: true,
    folderId,
    watching: watchRes.ok,
    message: watchRes.ok
      ? "Folder saved and webhook registered. Files will sync automatically."
      : "Folder saved. Webhook registration requires a public HTTPS URL (will work in production).",
  });
}

// GET: Get current watched folder
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const folderUrl = await prisma.setting.findUnique({
    where: { key: "drive_watch_folder_url" },
  });

  return NextResponse.json({
    folderUrl: folderUrl?.value || null,
  });
}

// DELETE: Stop watching
export async function DELETE() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const channelId = await prisma.setting.findUnique({
    where: { key: "drive_watch_channel_id" },
  });
  const resourceId = await prisma.setting.findUnique({
    where: { key: "drive_watch_resource_id" },
  });

  // Stop the channel
  if (channelId && resourceId) {
    const accessToken = await getGoogleAccessToken();
    if (accessToken) {
      await fetch("https://www.googleapis.com/drive/v3/channels/stop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId.value,
          resourceId: resourceId.value,
        }),
      });
    }
  }

  // Clean up settings
  await prisma.setting.deleteMany({
    where: {
      key: {
        in: [
          "drive_watch_folder_id",
          "drive_watch_folder_url",
          "drive_watch_channel_id",
          "drive_watch_resource_id",
          "drive_change_token",
        ],
      },
    },
  });

  return NextResponse.json({ success: true });
}
