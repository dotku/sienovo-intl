"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

interface KnowledgeFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  driveFileId: string | null;
  source: string;
  indexStatus: string;
  indexError: string | null;
  indexedAt: string | null;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgePage() {
  const { dict } = useI18n();
  const t = dict.admin?.knowledge || {};
  const tc = dict.admin?.common || {};

  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Watch folder
  const [watchedFolder, setWatchedFolder] = useState<string | null>(null);
  const [settingWatch, setSettingWatch] = useState(false);

  // Drive sync
  const [folderUrl, setFolderUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    synced: number;
    skipped: number;
    file: string;
    status: string;
  } | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);

  // Indexing
  const [indexingAll, setIndexingAll] = useState(false);
  const [indexingIds, setIndexingIds] = useState<Set<string>>(new Set());

  const handleIndex = async (fileId: string) => {
    setIndexingIds((prev) => new Set(prev).add(fileId));
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, indexStatus: "processing" } : f))
    );
    try {
      const res = await fetch(`/api/admin/knowledge/${fileId}/index`, { method: "POST" });
      if (res.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, indexStatus: "indexed", indexedAt: new Date().toISOString(), indexError: null }
              : f
          )
        );
      } else {
        const data = await res.json();
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, indexStatus: "error", indexError: data.error } : f
          )
        );
      }
    } catch {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, indexStatus: "error", indexError: "Failed" } : f))
      );
    }
    setIndexingIds((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  };

  const handleIndexAll = async () => {
    setIndexingAll(true);
    try {
      await fetch("/api/admin/knowledge/index-all", { method: "POST" });
      const res = await fetch("/api/admin/knowledge");
      if (res.ok) setFiles(await res.json());
    } catch {}
    setIndexingAll(false);
  };

  useEffect(() => {
    fetch("/api/admin/knowledge")
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));

    // Load watched folder
    fetch("/api/admin/knowledge/drive-watch")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.folderUrl) {
          setWatchedFolder(data.folderUrl);
          setFolderUrl(data.folderUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleDriveSync = async () => {
    if (!folderUrl) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncProgress(null);
    try {
      const res = await fetch("/api/admin/knowledge/drive-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl }),
      });

      // Check for auth redirect (non-SSE response)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await res.json();
        if (data.error === "reauth" && data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
        if (data.total === 0) {
          setSyncResult(data.message || "No files found.");
        } else {
          setSyncResult(data.error || "Sync failed.");
        }
        setSyncing(false);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setSyncing(false); return; }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m);
          if (!match) continue;
          try {
            const event = JSON.parse(match[1]);
            if (event.type === "progress") {
              setSyncProgress(event);
            } else if (event.type === "done") {
              setSyncResult(`Done! Synced ${event.synced} files, skipped ${event.skipped}.`);
              setSyncProgress(null);
              // Refresh list
              const listRes = await fetch("/api/admin/knowledge");
              if (listRes.ok) setFiles(await listRes.json());
            }
          } catch {}
        }
      }
    } catch {
      setSyncResult("Sync failed. Please try again.");
    }
    setSyncing(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setUploading(true);

    // Use the company files endpoint with a dummy — actually we need a dedicated upload endpoint
    // For now, let's use a simple approach via the knowledge API
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/knowledge/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const record = await res.json();
        setFiles((prev) => [record, ...prev]);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleWatch = async () => {
    if (!folderUrl) return;
    setSettingWatch(true);
    try {
      const res = await fetch("/api/admin/knowledge/drive-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl }),
      });
      if (res.ok) {
        setWatchedFolder(folderUrl);
        setSyncResult(t.folderWatched || "Folder is now watched. New files will sync automatically.");
      }
    } catch {}
    setSettingWatch(false);
  };

  const handleUnwatch = async () => {
    await fetch("/api/admin/knowledge/drive-watch", { method: "DELETE" });
    setWatchedFolder(null);
    setSyncResult(null);
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm(t.trashConfirm || "Move this file to trash? It will be permanently deleted after 30 days.")) return;
    const res = await fetch(`/api/admin/knowledge/${fileId}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">{tc.loading || "Loading..."}</p>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{t.title || "Knowledge Base"}</h2>
        <p className="text-sm text-gray-500">
          {(t.subtitle || "{count} files — sync from Google Drive or upload directly").replace("{count}", String(files.length))}
        </p>
      </div>

      {/* Google Drive Sync */}
      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.71 3.5L1.15 15l3.43 5.96h6.1L4.58 9.5 7.71 3.5zm1.81 0l6.47 11.22-3.09 5.78H6.36L12.83 9.5 9.52 3.5zm8.11 8L12.64 3.5h6.84l4.99 8.65-3.43 5.96h-6.1l2.69-6.61z" />
          </svg>
          {t.syncGoogleDrive || "Sync from Google Drive"}
        </h3>
        {watchedFolder && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-800 flex-1 truncate">
              {(t.autoSyncing || "Auto-syncing: {folder}").replace("{folder}", watchedFolder)}
            </span>
            <button
              onClick={handleUnwatch}
              className="text-xs text-green-600 hover:text-red-600 shrink-0"
            >
              {t.stopWatching || "Stop watching"}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="url"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
          />
          <button
            onClick={handleDriveSync}
            disabled={syncing || !folderUrl}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors whitespace-nowrap"
          >
            {syncing ? (t.syncing || "Syncing...") : (t.syncNow || "Sync Now")}
          </button>
          {!watchedFolder && (
            <button
              onClick={handleWatch}
              disabled={settingWatch || !folderUrl}
              className="border border-blue-300 text-blue-700 px-4 py-2 rounded text-sm font-medium hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors whitespace-nowrap"
            >
              {settingWatch ? (t.settingUp || "Setting up...") : (t.watchFolder || "Watch Folder")}
            </button>
          )}
        </div>
        {syncProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate max-w-xs">
                {syncProgress.status === "downloading" ? (t.downloading || "Downloading") : syncProgress.status === "synced" ? (t.synced || "Synced") : syncProgress.status === "exists" ? (t.skipped || "Skipped") : syncProgress.status} — {syncProgress.file}
              </span>
              <span className="text-gray-500 shrink-0 ml-2">
                {syncProgress.current}/{syncProgress.total}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{(t.syncedCount || "{count} synced").replace("{count}", String(syncProgress.synced))}</span>
              <span>{(t.skippedCount || "{count} skipped").replace("{count}", String(syncProgress.skipped))}</span>
            </div>
          </div>
        )}
        {syncResult && (
          <p className={`text-sm ${syncResult.includes("failed") ? "text-red-600" : "text-green-600"}`}>
            {syncResult}
          </p>
        )}
        <p className="text-xs text-gray-400">
          {t.helpText || "Files already synced will be skipped. Google Docs/Sheets/Slides are exported as PDF/CSV. Watched folders auto-sync on file create/delete. Deleted files go to trash for 30 days."}
        </p>
      </section>

      {/* Upload & Index */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">{t.filesAndRag || "Files & RAG Indexing"}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleIndexAll}
              disabled={indexingAll || files.every((f) => f.indexStatus === "indexed")}
              className="text-sm border border-blue-300 text-blue-700 px-4 py-2 rounded font-medium hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
            >
              {indexingAll ? (t.indexing || "Indexing...") : (t.indexAllPending || "Index All Pending")}
            </button>
            <label className="text-sm bg-gray-900 text-white px-4 py-2 rounded cursor-pointer hover:bg-gray-800 transition-colors font-medium">
              {uploading ? (tc.uploading || "Uploading...") : (t.uploadFiles || "Upload Files")}
              <input
                type="file"
                className="hidden"
                multiple
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Files List */}
      <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {files.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">{t.noFiles || "No files in knowledge base yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-700">{tc.file || "File"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{tc.source || "Source"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{tc.size || "Size"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{tc.date || "Date"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">RAG</th>
                  <th className="px-4 py-3 font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {files.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {f.name}
                      </a>
                      <div className="text-xs text-gray-400">{f.mimeType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        f.source === "google_drive"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {f.source === "google_drive" ? (t.googleDrive || "Google Drive") : (t.uploadSource || "Upload")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {formatFileSize(f.size)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {f.indexStatus === "indexed" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {t.indexed || "Indexed"}
                        </span>
                      ) : f.indexStatus === "processing" || indexingIds.has(f.id) ? (
                        <span className="text-xs text-blue-600 animate-pulse">{t.processing || "Processing..."}</span>
                      ) : f.indexStatus === "error" ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-600" title={f.indexError || ""}>{t.error || "Error"}</span>
                          <button
                            onClick={() => handleIndex(f.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {tc.retry || "Retry"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleIndex(f.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {t.process || "Process"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        {t.trash || "Trash"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
