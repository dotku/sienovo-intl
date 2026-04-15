#!/usr/bin/env node

/**
 * Score articles based purely on CSDN metrics + recency.
 * No AI. Outputs ranked shortlist for human review.
 *
 * Inputs:
 *   data/csdn-metrics.json   (from fetch-csdn-metrics.mjs)
 *   content/blog/*.mdx       (original CN, for tags/date)
 *   content/blog-en/*.mdx    (EN translation status)
 *   data/published.jsonl     (optional, to exclude already-posted)
 *   data/rejected.csv        (optional, to exclude rejected ones)
 *
 * Output:
 *   data/scored.json         (full ranked list with score breakdown)
 *   data/shortlist.csv       (top N, human-reviewable)
 *
 * Usage:
 *   node scripts/score-articles.mjs              # default top 200 in shortlist
 *   node scripts/score-articles.mjs --top 100
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const BLOG_DIR = join(PROJECT_ROOT, "content/blog");
const BLOG_EN_DIR = join(PROJECT_ROOT, "content/blog-en");
const DATA_DIR = join(PROJECT_ROOT, "data");
const METRICS_FILE = join(DATA_DIR, "csdn-metrics.json");
const PUBLISHED_FILE = join(DATA_DIR, "published.jsonl");
const REJECTED_FILE = join(DATA_DIR, "rejected.csv");
const OUT_JSON = join(DATA_DIR, "scored.json");
const OUT_CSV = join(DATA_DIR, "shortlist.csv");

const args = process.argv.slice(2);
const TOP = args.includes("--top")
  ? parseInt(args[args.indexOf("--top") + 1], 10)
  : 200;

// ── Load metrics ────────────────────────────────────────────────────────────
if (!existsSync(METRICS_FILE)) {
  console.error(`Missing ${METRICS_FILE}. Run fetch-csdn-metrics.mjs first.`);
  process.exit(1);
}
const metrics = JSON.parse(readFileSync(METRICS_FILE, "utf-8"));

// ── Load excluded IDs (published + rejected) ────────────────────────────────
const excluded = new Set();
if (existsSync(PUBLISHED_FILE)) {
  for (const line of readFileSync(PUBLISHED_FILE, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.id) excluded.add(rec.id);
    } catch {}
  }
}
if (existsSync(REJECTED_FILE)) {
  for (const line of readFileSync(REJECTED_FILE, "utf-8").split("\n").slice(1)) {
    const id = line.split(",")[0]?.trim();
    if (id) excluded.add(id);
  }
}

// ── Load frontmatter for tags/date ──────────────────────────────────────────
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    else if (v.startsWith("[") && v.endsWith("]")) {
      v = v.slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    fm[kv[1]] = v;
  }
  return fm;
}

const blogIndex = {};
for (const file of readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"))) {
  const id = file.replace(/\.mdx$/, "");
  const raw = readFileSync(join(BLOG_DIR, file), "utf-8");
  blogIndex[id] = parseFrontmatter(raw) || {};
}

const translatedIds = new Set(
  existsSync(BLOG_EN_DIR)
    ? readdirSync(BLOG_EN_DIR)
        .filter((f) => f.endsWith(".mdx"))
        .map((f) => f.replace(/\.mdx$/, ""))
    : []
);

// ── Score each article ──────────────────────────────────────────────────────
const MONTH_MS = 30 * 24 * 3600 * 1000;
const now = Date.now();

function recencyMultiplier(dateStr) {
  if (!dateStr) return 1.0;
  const t = Date.parse(dateStr);
  if (isNaN(t)) return 1.0;
  const months = (now - t) / MONTH_MS;
  if (months < 12) return 1.15;
  if (months < 24) return 1.0;
  if (months < 36) return 0.9;
  return 0.8;
}

const log10 = (n) => Math.log10(Math.max(1, (n || 0) + 1));

const scored = [];
for (const [id, m] of Object.entries(metrics)) {
  if (excluded.has(id)) continue;
  if (m.error || m.views == null) continue;

  const views = m.views ?? 0;
  const likes = m.likes ?? 0;
  const favors = m.favors ?? 0;
  const comments = m.comments ?? 0;

  const fm = blogIndex[id] || {};
  const date = fm.date || "";
  const recency = recencyMultiplier(date);

  // Raw components (log-scaled so outliers don't dominate)
  const s_views = log10(views) * 1.0;
  const s_favors = log10(favors) * 2.0;  // favorites = strongest signal for technical content
  const s_likes = log10(likes) * 0.8;
  const s_comments = log10(comments) * 0.6;

  const base = s_views + s_favors + s_likes + s_comments;
  const score = +(base * recency).toFixed(3);

  scored.push({
    id,
    score,
    views,
    likes,
    favors,
    comments,
    date,
    recency_x: +recency.toFixed(2),
    title: fm.title || m.title || "",
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    url: fm.source || m.url || "",
    translated: translatedIds.has(id),
    breakdown: {
      views: +s_views.toFixed(2),
      favors: +s_favors.toFixed(2),
      likes: +s_likes.toFixed(2),
      comments: +s_comments.toFixed(2),
    },
  });
}

scored.sort((a, b) => b.score - a.score);

// ── Write full scored JSON ──────────────────────────────────────────────────
writeFileSync(OUT_JSON, JSON.stringify(scored, null, 2), "utf-8");

// ── Write CSV shortlist ─────────────────────────────────────────────────────
const csvHeader = [
  "rank",
  "id",
  "score",
  "views",
  "favors",
  "likes",
  "comments",
  "date",
  "recency_x",
  "translated",
  "tags",
  "title",
  "url",
  "decision", // user fills in: approve / reject / hold
  "notes",
];

const escapeCsv = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const shortlist = scored.slice(0, TOP);
const lines = [csvHeader.join(",")];
for (let i = 0; i < shortlist.length; i++) {
  const a = shortlist[i];
  lines.push(
    [
      i + 1,
      a.id,
      a.score,
      a.views,
      a.favors,
      a.likes,
      a.comments,
      a.date,
      a.recency_x,
      a.translated ? "yes" : "no",
      a.tags.join(" | "),
      a.title,
      a.url,
      "",
      "",
    ]
      .map(escapeCsv)
      .join(",")
  );
}
writeFileSync(OUT_CSV, lines.join("\n") + "\n", "utf-8");

// ── Summary ─────────────────────────────────────────────────────────────────
const byTag = {};
for (const a of shortlist) {
  for (const t of a.tags) byTag[t] = (byTag[t] || 0) + 1;
}
const topTags = Object.entries(byTag)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12);

console.log("=".repeat(70));
console.log(`Scored: ${scored.length} articles (excluded: ${excluded.size})`);
console.log(`Shortlist (top ${TOP}): ${OUT_CSV}`);
console.log(`Full scored:            ${OUT_JSON}`);
console.log("");
console.log("Top 20 preview:");
console.log("─".repeat(70));
for (let i = 0; i < Math.min(20, shortlist.length); i++) {
  const a = shortlist[i];
  const title = a.title.length > 45 ? a.title.slice(0, 42) + "..." : a.title;
  console.log(
    `${String(i + 1).padStart(3)}. [${a.score.toFixed(2)}] ` +
      `v=${String(a.views).padStart(6)} ★${String(a.favors).padStart(4)} ` +
      `♥${String(a.likes).padStart(3)} 💬${String(a.comments).padStart(2)} ` +
      `${title}`
  );
}
console.log("");
console.log("Top tags in shortlist:");
for (const [tag, count] of topTags) {
  console.log(`  ${String(count).padStart(3)} × ${tag}`);
}
