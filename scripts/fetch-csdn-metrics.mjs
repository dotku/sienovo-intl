#!/usr/bin/env node

/**
 * Fetch CSDN article metrics (views / likes / favorites / comments).
 * Lightweight — no image processing. Resumable.
 *
 * Usage:
 *   node scripts/fetch-csdn-metrics.mjs --test            # 3 articles, verify selectors
 *   node scripts/fetch-csdn-metrics.mjs                   # all, skip already-fetched
 *   node scripts/fetch-csdn-metrics.mjs --force           # re-fetch all
 *   node scripts/fetch-csdn-metrics.mjs --concurrency 5   # parallel tabs (default 3)
 *   node scripts/fetch-csdn-metrics.mjs --limit 50        # first N only
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const BLOG_DIR = join(PROJECT_ROOT, "content/blog");
const DATA_DIR = join(PROJECT_ROOT, "data");
const OUTPUT = join(DATA_DIR, "csdn-metrics.json");

const args = process.argv.slice(2);
const TEST = args.includes("--test");
const FORCE = args.includes("--force");
const CONCURRENCY = args.includes("--concurrency")
  ? parseInt(args[args.indexOf("--concurrency") + 1], 10)
  : 3;
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : Infinity;

mkdirSync(DATA_DIR, { recursive: true });

// ── Load existing metrics (for resume) ──────────────────────────────────────
let metrics = {};
if (existsSync(OUTPUT) && !FORCE) {
  metrics = JSON.parse(readFileSync(OUTPUT, "utf-8"));
  console.log(`Loaded ${Object.keys(metrics).length} existing metrics from ${OUTPUT}`);
}

// ── Collect articles to fetch ───────────────────────────────────────────────
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*"?(.+?)"?$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
}

const allArticles = [];
for (const file of readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"))) {
  const id = file.replace(/\.mdx$/, "");
  const raw = readFileSync(join(BLOG_DIR, file), "utf-8");
  const fm = parseFrontmatter(raw);
  if (!fm?.source) continue;
  allArticles.push({ id, url: fm.source, title: fm.title, date: fm.date });
}

// Resume: skip only successfully-fetched (has views); retry errored entries
let targets = FORCE
  ? allArticles
  : allArticles.filter((a) => !metrics[a.id] || metrics[a.id].views == null);

if (TEST) targets = allArticles.slice(0, 3);
else if (LIMIT !== Infinity) targets = targets.slice(0, LIMIT);

console.log(`Total articles:   ${allArticles.length}`);
console.log(`Already fetched:  ${Object.keys(metrics).length}`);
console.log(`To fetch:         ${targets.length}`);
console.log(`Concurrency:      ${CONCURRENCY}`);
console.log(`Mode:             ${TEST ? "TEST (3 articles)" : FORCE ? "FORCE" : "RESUME"}`);
console.log("");

if (targets.length === 0) {
  console.log("Nothing to fetch.");
  process.exit(0);
}

// ── Extract metrics from a page ─────────────────────────────────────────────
async function extractMetrics(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  // Metrics can be lazy-loaded; wait briefly for read-count element
  await page.waitForSelector(".read-count, #articleCountInPage, .csdn-tracking-statistics, .blog-footer-bottom", {
    timeout: 5000,
  }).catch(() => {});

  return page.evaluate(() => {
    // Parse "2.8k", "1.5w", "1234" → integer
    const parseCnNumber = (s) => {
      if (!s) return null;
      const m = s.match(/([\d.,]+)\s*([kKwW万千])?/);
      if (!m) return null;
      const num = parseFloat(m[1].replace(/,/g, ""));
      if (isNaN(num)) return null;
      const suf = m[2]?.toLowerCase();
      if (suf === "k" || suf === "千") return Math.round(num * 1000);
      if (suf === "w" || suf === "万") return Math.round(num * 10000);
      return Math.round(num);
    };

    const pickNumber = (sel) => {
      const el = document.querySelector(sel);
      return el ? parseCnNumber(el.textContent) : null;
    };

    // Views: CSDN has multiple .read-count elements; only the one containing "阅读" is the real view counter
    const views = (() => {
      const candidates = [...document.querySelectorAll(".read-count, .read-num, [class*='read']")];
      for (const el of candidates) {
        if (/阅读/.test(el.textContent || "")) return parseCnNumber(el.textContent);
      }
      const bodyText = document.body.innerText;
      const m = bodyText.match(/([\d.,]+\s*[kKwW万千]?)\s*阅读/);
      return m ? parseCnNumber(m[1]) : null;
    })();

    // Likes: #spanCount is reliable; #blog-digg-num is a separate like display
    const likes =
      pickNumber("#spanCount") ??
      pickNumber("#blog-digg-num") ??
      pickNumber(".tool-item-like .count");

    const favors =
      pickNumber("#get-collection") ??
      pickNumber("#blog_detail_zk_collection .get-collection") ??
      pickNumber(".get-collection") ??
      pickNumber("#get-collection-btn .count") ??
      pickNumber(".tool-item-collection .count");

    const comments =
      pickNumber("#commentCount") ??
      pickNumber(".tool-item-comment .count") ??
      (() => {
        const btn = document.querySelector(".tool-item-comment, #btnComment");
        if (!btn) return null;
        const m = btn.textContent.match(/[\d,]+/);
        return m ? parseInt(m[0].replace(/,/g, ""), 10) : null;
      })();

    return { views, likes, favors, comments };
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
function save() {
  writeFileSync(OUTPUT, JSON.stringify(metrics, null, 2), "utf-8");
}

let saveCounter = 0;
async function processOne(page, article, idx, total) {
  const { id, url, title } = article;
  const label = `[${idx + 1}/${total}] ${id}`;
  try {
    const m = await extractMetrics(page, url);
    metrics[id] = {
      ...m,
      title,
      url,
      fetched_at: new Date().toISOString(),
    };
    const parts = [
      `views=${m.views ?? "?"}`,
      `likes=${m.likes ?? "?"}`,
      `favors=${m.favors ?? "?"}`,
      `comments=${m.comments ?? "?"}`,
    ];
    console.log(`${label} ✓ ${parts.join(" ")}  ${title.substring(0, 40)}`);

    saveCounter++;
    if (saveCounter % 10 === 0) save();
  } catch (err) {
    console.log(`${label} ✗ ${err.message.substring(0, 60)}`);
    metrics[id] = { error: err.message.substring(0, 200), fetched_at: new Date().toISOString() };
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: !TEST,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  // Block images/media/fonts for speed
  await context.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (["image", "media", "font", "stylesheet"].includes(t)) return route.abort();
    route.continue();
  });

  // Create a pool of pages
  const pages = [];
  for (let i = 0; i < CONCURRENCY; i++) pages.push(await context.newPage());

  const queue = [...targets];
  let processed = 0;
  const total = targets.length;

  await Promise.all(
    pages.map(async (page) => {
      while (queue.length > 0) {
        const article = queue.shift();
        if (!article) break;
        await processOne(page, article, processed++, total);
        // Longer, more random delay to avoid triggering CSDN rate limiting
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
      }
    })
  );

  save();
  await browser.close();

  // Summary
  const ok = Object.values(metrics).filter((m) => m.views != null).length;
  const failed = Object.values(metrics).filter((m) => m.error).length;
  console.log("");
  console.log("=".repeat(60));
  console.log(`Fetched OK: ${ok}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Output:     ${OUTPUT}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  save();
  process.exit(1);
});
