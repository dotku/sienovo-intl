"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";

interface Article {
  id: string;
  title: string;
  content: string;
  category: string | null;
  indexStatus: string;
  indexError: string | null;
  indexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Filter = "all" | "indexed" | "pending" | "error";

export default function ArticlesPage() {
  const { dict } = useI18n();
  const t = dict.admin?.articles || {};

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [indexingIds, setIndexingIds] = useState<Set<string>>(new Set());

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/knowledge/articles");
      if (res.ok) {
        const list = await res.json();
        // Fetch full content for each — but the list API only returns summary
        // We'll load full content on select
        setArticles(list);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const selectedArticle = articles.find((a) => a.id === selectedId);

  const loadArticle = async (id: string) => {
    setSelectedId(id);
    setEditing(false);
    // Load full content
    try {
      const res = await fetch(`/api/admin/knowledge/articles/${id}`);
      if (res.ok) {
        const full = await res.json();
        setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, ...full } : a)));
      }
    } catch { /* ignore */ }
  };

  const startEdit = () => {
    if (!selectedArticle) return;
    setEditTitle(selectedArticle.title);
    setEditContent(selectedArticle.content || "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/knowledge/articles/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (res.ok) {
        const updated = await res.json();
        setArticles((prev) =>
          prev.map((a) => (a.id === selectedId ? { ...a, ...updated } : a))
        );
        setEditing(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.deleteConfirm || "Delete this article permanently? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/knowledge/articles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) { setSelectedId(null); setEditing(false); }
    }
  };

  const handleReindex = async (id: string) => {
    setIndexingIds((prev) => new Set(prev).add(id));
    setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, indexStatus: "processing" } : a)));
    try {
      const res = await fetch(`/api/admin/knowledge/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reindex: true, content: articles.find((a) => a.id === id)?.content }),
      });
      if (res.ok) {
        const updated = await res.json();
        setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      }
    } catch {
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, indexStatus: "error" } : a)));
    }
    setIndexingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  // Filter & search
  const filtered = articles.filter((a) => {
    if (filter !== "all" && a.indexStatus !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q);
    }
    return true;
  });

  // Stats
  const stats = {
    total: articles.length,
    indexed: articles.filter((a) => a.indexStatus === "indexed").length,
    pending: articles.filter((a) => a.indexStatus === "pending").length,
    error: articles.filter((a) => a.indexStatus === "error").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">{dict.admin?.common?.loading || "Loading..."}</p>
      </div>
    );
  }

  return (
    <main className="flex h-screen">
      {/* Left panel — article list */}
      <div className="w-96 shrink-0 border-r border-gray-200 flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t.title || "Articles"}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.total} {t.total || "total"} · {stats.indexed} {t.indexed || "indexed"} · {stats.pending} {t.pending || "pending"} · {stats.error} {t.errors || "errors"}
          </p>
        </div>

        {/* Search + Filter */}
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder || "Search articles..."}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
          />
          <div className="flex gap-1">
            {(["all", "indexed", "pending", "error"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filter === f
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all" ? `${t.all || "All"} (${stats.total})` :
                 f === "indexed" ? `${t.indexed || "Indexed"} (${stats.indexed})` :
                 f === "pending" ? `${t.pending || "Pending"} (${stats.pending})` :
                 `${t.error || "Error"} (${stats.error})`}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">{t.noArticles || "No articles found"}</p>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                onClick={() => loadArticle(a.id)}
                className={`px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedId === a.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{a.title}</p>
                  <StatusBadge status={a.indexStatus} labels={t} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {a.category && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      a.category.startsWith("blog-en") ? "bg-blue-50 text-blue-600" :
                      a.category.startsWith("blog-zh") ? "bg-purple-50 text-purple-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {a.category.startsWith("blog-en") ? "EN" :
                       a.category.startsWith("blog-zh") ? "ZH" :
                       a.category}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel — article detail / editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {!selectedArticle ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">{t.selectArticle || "Select an article to view"}</p>
          </div>
        ) : editing ? (
          /* Edit mode */
          <>
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex-1 mr-4">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-lg font-semibold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-blue-500 pb-1"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
                >
                  {t.cancel || "Cancel"}
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {saving ? (t.saving || "Saving...") : (t.save || "Save & Re-index")}
                </button>
              </div>
            </div>
            <div className="flex-1 p-6">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-full p-4 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </>
        ) : (
          /* View mode */
          <>
            <div className="px-6 py-4 bg-white border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedArticle.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={selectedArticle.indexStatus} />
                    {selectedArticle.category && (
                      <span className="text-xs text-gray-400">{selectedArticle.category}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(selectedArticle.updatedAt || selectedArticle.createdAt).toLocaleString()}
                    </span>
                    {selectedArticle.indexError && (
                      <span className="text-xs text-red-500" title={selectedArticle.indexError}>
                        {selectedArticle.indexError.slice(0, 60)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  {(selectedArticle.indexStatus === "pending" || selectedArticle.indexStatus === "error") && (
                    <button
                      onClick={() => handleReindex(selectedArticle.id)}
                      disabled={indexingIds.has(selectedArticle.id)}
                      className="text-sm px-3 py-1.5 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {indexingIds.has(selectedArticle.id) ? (t.indexing || "Indexing...") : (t.index || "Index")}
                    </button>
                  )}
                  <button
                    onClick={startEdit}
                    className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                  >
                    {t.edit || "Edit"}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedArticle.id)}
                    className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"
                  >
                    {t.delete || "Delete"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {selectedArticle.content || (t.noContent || "No content")}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status, labels }: { status: string; labels?: Record<string, string> }) {
  const l = labels || {};
  switch (status) {
    case "indexed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          {l.indexed || "Indexed"}
        </span>
      );
    case "processing":
      return <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">{l.processing || "Processing"}</span>;
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          {l.error || "Error"}
        </span>
      );
    default:
      return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{l.pending || "Pending"}</span>;
  }
}
