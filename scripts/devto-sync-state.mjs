// One-shot: fetch every article from your Dev.to account and rebuild
// data/devto-published.jsonl from authoritative source.
//
// Use when devto-published.jsonl has drifted from reality (e.g. you started
// seeing repeated "Canonical url has already been taken" 422s).
//
// Run: DEVTO_API_KEY=... node scripts/devto-sync-state.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const STATE_FILE = path.join(REPO_ROOT, "data/devto-published.jsonl");
const API_KEY = process.env.DEVTO_API_KEY;

if (!API_KEY) {
  console.error("DEVTO_API_KEY env var required.");
  process.exit(1);
}

async function fetchAll() {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://dev.to/api/articles/me/all?page=${page}&per_page=1000`;
    const r = await fetch(url, { headers: { "api-key": API_KEY } });
    if (!r.ok) {
      console.error(`HTTP ${r.status} from ${url}`);
      const body = await r.text();
      console.error(body.slice(0, 500));
      process.exit(1);
    }
    const batch = await r.json();
    all.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }
  return all;
}

const articles = await fetchAll();
console.log(`fetched ${articles.length} dev.to articles for this account`);

// Sienovo canonical: https://sienovo.jytech.us/blog/{slug}
// also tolerate legacy https://sienovo.jytech.us/en/blog/{slug}
const SLUG_FROM_CANONICAL = /https?:\/\/sienovo\.jytech\.us\/(?:en\/)?blog\/([^\/?#]+)/;

const rows = [];
const seen = new Set();
for (const a of articles) {
  const canonical = a.canonical_url || "";
  const m = canonical.match(SLUG_FROM_CANONICAL);
  if (!m) continue; // skip non-sienovo articles
  const slug = m[1];
  if (seen.has(slug)) continue; // dedupe (sometimes a slug has multiple dev.to entries)
  seen.add(slug);
  rows.push({
    slug,
    title: a.title,
    dev_to_id: a.id,
    dev_to_url: a.url,
    canonical_url: canonical,
    published_at: a.published_at || a.created_at,
    draft: !a.published,
    syncedFromApi: true,
  });
}

// Sort by date for readability
rows.sort((a, b) =>
  (a.published_at || "").localeCompare(b.published_at || ""),
);

// Back up existing file
if (fs.existsSync(STATE_FILE)) {
  fs.copyFileSync(STATE_FILE, `${STATE_FILE}.bak.${Date.now()}`);
}

fs.writeFileSync(
  STATE_FILE,
  rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""),
);

console.log(`✓ wrote ${rows.length} unique sienovo slugs to ${STATE_FILE}`);
console.log(`  (rejected ${articles.length - rows.length} non-sienovo or duplicate)`);
console.log(`\nNext step: git add data/devto-published.jsonl && git commit && git push`);
