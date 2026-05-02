import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 300; // refresh stats from Dev.to every 5 min

interface LocalEntry {
  slug: string;
  title: string;
  dev_to_id: number;
  dev_to_url: string;
  canonical_url: string;
  published_at: string;
  draft: boolean;
}

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  published: boolean;
  published_at: string | null;
  page_views_count: number;
  public_reactions_count: number;
  comments_count: number;
  reading_time_minutes: number;
  tag_list: string[];
}

function loadLocalEntries(): LocalEntry[] {
  const file = join(process.cwd(), "data/devto-published.jsonl");
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  // Dedupe by slug — last entry wins so refreshes (which append a fresh
  // record with the up-to-date `draft` field) override earlier writes.
  const bySlug = new Map<string, LocalEntry>();
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      if (r?.slug) bySlug.set(r.slug, r);
    } catch {}
  }
  return Array.from(bySlug.values());
}

async function fetchDevToStats(): Promise<DevToArticle[]> {
  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) return [];
  const all: DevToArticle[] = [];
  for (let page = 1; page <= 50; page++) {
    try {
      const resp = await fetch(
        `https://dev.to/api/articles/me/all?page=${page}&per_page=30`,
        {
          headers: {
            "api-key": apiKey,
            Accept: "application/vnd.forem.api-v1+json",
          },
          next: { revalidate: 300 },
        },
      );
      if (!resp.ok) break;
      const data = (await resp.json()) as DevToArticle[];
      if (!Array.isArray(data) || data.length === 0) break;
      all.push(...data);
      if (data.length < 30) break;
    } catch {
      break;
    }
  }
  return all;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function DevToAdminPage() {
  const local = loadLocalEntries();
  const live = await fetchDevToStats();

  const liveById = new Map(live.map((a) => [a.id, a]));

  const rows = local.map((e) => {
    const l = liveById.get(e.dev_to_id);
    return {
      slug: e.slug,
      title: l?.title || e.title,
      url: l?.url || e.dev_to_url,
      published: l ? l.published : !e.draft,
      published_at: l?.published_at || e.published_at,
      views: l?.page_views_count ?? 0,
      reactions: l?.public_reactions_count ?? 0,
      comments: l?.comments_count ?? 0,
      readingMin: l?.reading_time_minutes ?? 0,
      tags: l?.tag_list ?? [],
      canonical: e.canonical_url,
    };
  });

  // Sort newest first.
  rows.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));

  const totalPublished = rows.filter((r) => r.published).length;
  const totalDrafts = rows.filter((r) => !r.published).length;
  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  const totalReactions = rows.reduce((s, r) => s + r.reactions, 0);
  const totalComments = rows.reduce((s, r) => s + r.comments, 0);

  const apiAvailable = !!process.env.DEVTO_API_KEY;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dev.to Publications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sienovo articles cross-posted from{" "}
          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
            content/blog-en/
          </code>{" "}
          to Dev.to. Stats refresh every 5 minutes.
        </p>
      </header>

      {!apiAvailable && (
        <div className="mb-6 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
          <b>DEVTO_API_KEY</b> not set in this environment — showing local-state
          counts only. Live views/reactions/comments require the API key.
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Stat label="Published" value={totalPublished} accent="text-green-700" />
        <Stat label="Drafts" value={totalDrafts} accent="text-amber-600" />
        <Stat label="Total Views" value={totalViews.toLocaleString()} />
        <Stat label="Reactions" value={totalReactions.toLocaleString()} />
        <Stat label="Comments" value={totalComments.toLocaleString()} />
      </section>

      <section className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Published</th>
              <th className="px-4 py-3 text-right">Views</th>
              <th className="px-4 py-3 text-right">♥</th>
              <th className="px-4 py-3 text-right">💬</th>
              <th className="px-4 py-3 text-left">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-gray-500 italic"
                >
                  No articles posted yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.slug} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:underline font-medium"
                  >
                    {r.title}
                  </a>
                  <div className="text-xs text-gray-400 mt-0.5">
                    canonical:{" "}
                    <a
                      href={r.canonical}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {r.canonical}
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.published ? (
                    <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
                      Published
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-800">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {fmtDate(r.published_at)}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {r.views.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {r.reactions}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {r.comments}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {r.tags.slice(0, 3).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-gray-900",
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
