"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  platform: "xiaohongshu" | "weixin";
  source?: string;
  author?: string;
}

type Platform = "xiaohongshu" | "weixin" | "linkedin" | "youtube" | "reddit" | "twitter" | "tiktok" | "facebook" | "instagram" | "threads" | "all_cn" | "all_global" | "all";
type SearchType = "competitor" | "buyer" | "kol" | "keyword";

const PRESET_TAGS_CN = [
  "边缘AI", "视觉检测", "智能制造", "工业相机", "缺陷检测",
  "机器视觉", "AI盒子", "安防监控", "智慧工厂", "工业自动化",
];

const PRESET_TAGS_EN = [
  "edge AI", "machine vision", "defect detection", "smart manufacturing",
  "industrial camera", "factory automation", "warehouse safety", "quality inspection",
];

const PLATFORM_GROUPS = [
  { label: "All", key: "all" },
  { label: "China", key: "all_cn" },
  { label: "Global", key: "all_global" },
  { label: "──", key: "divider" },
  { label: "小红书", key: "xiaohongshu" },
  { label: "微信", key: "weixin" },
  { label: "LinkedIn", key: "linkedin" },
  { label: "YouTube", key: "youtube" },
  { label: "Reddit", key: "reddit" },
  { label: "X", key: "twitter" },
  { label: "TikTok", key: "tiktok" },
  { label: "Facebook", key: "facebook" },
  { label: "Instagram", key: "instagram" },
  { label: "Threads", key: "threads" },
];

const PLATFORM_COLORS: Record<string, string> = {
  xiaohongshu: "bg-red-100 text-red-700",
  weixin: "bg-green-100 text-green-700",
  linkedin: "bg-blue-100 text-blue-700",
  youtube: "bg-red-50 text-red-600",
  reddit: "bg-orange-100 text-orange-700",
  twitter: "bg-sky-100 text-sky-700",
  tiktok: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-50 text-blue-800",
  instagram: "bg-fuchsia-100 text-fuchsia-700",
  threads: "bg-gray-200 text-gray-800",
};

const TYPE_LABELS: Record<string, { en: string; zh: string }> = {
  competitor: { en: "Competitors", zh: "竞品" },
  buyer: { en: "Buyers", zh: "潜在买家" },
  kol: { en: "KOL / Bloggers", zh: "KOL / 博主" },
  keyword: { en: "Keywords", zh: "关键词" },
};

export default function SocialSearchPage() {
  const { dict, locale } = useI18n();
  const t = dict.admin?.outreach || {};
  const tc = dict.admin?.common || {};

  const [platform, setPlatform] = useState<Platform>("all");
  const [type, setType] = useState<SearchType>("keyword");
  const [keywords, setKeywords] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!keywords.trim()) return;
    setSearching(true);
    setSearched(true);
    const res = await fetch("/api/admin/outreach/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, platform, type }),
    });
    if (res.ok) {
      const data = await res.json();
      setResults(data.results || []);
    }
    setSearching(false);
  };

  const addTag = (tag: string) => {
    const current = keywords.trim();
    if (current.includes(tag)) return;
    setKeywords(current ? `${current} ${tag}` : tag);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            {t.socialSearch || "Social Media Search"}
          </h1>
          <Link href="/admin/outreach" className="text-sm text-gray-500 hover:text-gray-900">
            {tc.back || "Back"}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Search Controls */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          {/* Platform */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              {t.socialPlatform || "Platform"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_GROUPS.map((p) =>
                p.key === "divider" ? (
                  <span key="divider" className="text-gray-300 self-center px-1">|</span>
                ) : (
                  <button
                    key={p.key}
                    onClick={() => setPlatform(p.key as Platform)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      platform === p.key
                        ? "bg-gray-900 text-white"
                        : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p.label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Search Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              {t.socialSearchType || "Search Type"}
            </label>
            <div className="flex gap-2">
              {(["keyword", "competitor", "buyer", "kol"] as SearchType[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setType(st)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    type === st
                      ? "bg-purple-600 text-white"
                      : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {TYPE_LABELS[st][locale === "zh" ? "zh" : "en"]}
                </button>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              {t.socialKeywords || "Keywords"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                placeholder={t.socialKeywordsPlaceholder || "e.g. 工业视���检测, 边缘AI"}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !keywords.trim()}
                className="bg-gray-900 text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
              >
                {searching ? (tc.searching || "Searching...") : (tc.search || "Search")}
              </button>
            </div>
          </div>

          {/* Preset Tags */}
          <div className="flex flex-wrap gap-1.5">
            {(["all_cn", "xiaohongshu", "weixin"].includes(platform)
              ? PRESET_TAGS_CN
              : ["all_global", "linkedin", "youtube", "reddit", "twitter", "tiktok"].includes(platform)
              ? PRESET_TAGS_EN
              : [...PRESET_TAGS_CN.slice(0, 5), ...PRESET_TAGS_EN.slice(0, 5)]
            ).map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {searching && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">{t.socialSearching || "Searching social platforms..."}</p>
          </div>
        )}

        {!searching && searched && results.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">{t.socialNoResults || "No results found"}</p>
            <p className="text-sm mt-1">{t.socialTryDifferent || "Try different keywords or platform"}</p>
          </div>
        )}

        {!searching && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              {t.socialFound || "Found"} {results.length} {t.socialResultsCount || "results"}
            </p>
            {results.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          PLATFORM_COLORS[r.platform] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {r.source || r.platform}
                      </span>
                      {r.author && (
                        <span className="text-xs text-gray-400 shrink-0">@{r.author}</span>
                      )}
                      <h3 className="text-sm font-medium text-gray-900 truncate">{r.title}</h3>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{r.snippet}</p>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {t.socialVisit || "Visit"} →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
