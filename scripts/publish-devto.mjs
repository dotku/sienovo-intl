#!/usr/bin/env node
/**
 * Publish English blog translations to Dev.to.
 *
 * Compliance with dev.to community rules (https://dev.to/code-of-conduct):
 *   - canonical_url points back to sienovo's English blog → no duplicate-content
 *     hit on the original site, attribution preserved
 *   - <= 4 tags, lowercased + alphanumeric/-
 *   - AI-translation disclosure footer on every post (transparency rule)
 *   - Default volume cap: 3/day to stay under spam thresholds
 *   - Tracks published slugs in data/devto-published.jsonl so reruns are
 *     idempotent and we never double-post
 *
 * Usage:
 *   node scripts/publish-devto.mjs --limit 3                # publish 3 new
 *   node scripts/publish-devto.mjs --limit 3 --draft        # post as drafts
 *   node scripts/publish-devto.mjs --limit 3 --dry-run      # print, no POST
 *
 * Env:
 *   DEVTO_API_KEY        required to actually POST
 *   NEXT_PUBLIC_SITE_URL canonical site URL (default: sienovo.jytech.us)
 *   DEVTO_ORG_ID         optional — post under a Dev.to organization
 */
import { readdirSync, readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import matter from "gray-matter";

// ---------- config ----------

const args = parseArgs(process.argv.slice(2));
const LIMIT = Number(args.limit ?? 3);
const DRY_RUN = !!args["dry-run"];
const DRAFT = !!args.draft;

const REPO_ROOT = process.cwd();
const BLOG_EN_DIR = join(REPO_ROOT, "content/blog-en");
const STATE_FILE = join(REPO_ROOT, "data/devto-published.jsonl");
const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://sienovo.jytech.us").replace(/\/+$/, "");

const ORG_ID = process.env.DEVTO_ORG_ID;
const API_KEY = process.env.DEVTO_API_KEY;

// Quality gates so the first batches set a credible technical tone on Dev.to.
const HAS_CJK = /[一-鿿]/;
const PERSONAL_TITLE_PATTERNS = [
  /^Reflect/i,
  /^Diary/i,
  /My Learning/i,
  /Personal Notes/i,
  /Random Thoughts/i,
  /Interview Question$/i,
  /Classic Interview Question/i,
];
const MIN_BODY_CHARS = 3000;

// ---------- main ----------

if (!existsSync(BLOG_EN_DIR)) {
  fail(`content/blog-en not found at ${BLOG_EN_DIR}`);
}
if (!DRY_RUN && !API_KEY) {
  fail("DEVTO_API_KEY is required (use --dry-run to preview without posting)");
}

// --refresh <slug>: update an already-posted article in place (PUT) so brand
// intro / footer / tags can be re-rendered without creating a new entry.
// --draft is honored to control published state.
if (args.refresh) {
  const refreshResult = await refreshArticle(args.refresh);
  process.exit(refreshResult.ok ? 0 : 1);
}

const published = loadPublishedSlugs();
const candidates = readCandidates().filter((p) => !published.has(p.slug));

console.log(
  `Pool: ${published.size} already published, ${candidates.length} unpublished, ` +
  `picking ${Math.min(LIMIT, candidates.length)} (longest first).`
);

if (candidates.length === 0) {
  console.log("Nothing to publish. Done.");
  process.exit(0);
}

const batch = candidates.slice(0, LIMIT);

const results = [];
for (const post of batch) {
  const payload = buildArticlePayload(post);
  if (DRY_RUN) {
    console.log("\n--- DRY RUN ---");
    console.log(`title: ${payload.article.title}`);
    console.log(`canonical: ${payload.article.canonical_url}`);
    console.log(`tags: ${payload.article.tags.join(", ")}`);
    console.log(`published: ${payload.article.published}`);
    console.log(`body length: ${payload.article.body_markdown.length}`);
    results.push({ slug: post.slug, ok: true, dryRun: true });
    continue;
  }

  const r = await postArticle(payload);
  if (r.ok) {
    appendPublished({
      slug: post.slug,
      title: post.title,
      dev_to_id: r.id,
      dev_to_url: r.url,
      canonical_url: payload.article.canonical_url,
      published_at: new Date().toISOString(),
      draft: DRAFT,
    });
    console.log(`✓ ${post.slug}  →  ${r.url}`);
  } else {
    console.error(`✗ ${post.slug}  →  ${r.error}`);
  }
  results.push({ slug: post.slug, ...r });

  // Light pacing between posts (Dev.to is fine, this is courtesy)
  await sleep(2000);
}

const fails = results.filter((r) => !r.ok).length;
console.log(`\nDone: ${results.length - fails} ok / ${fails} failed`);
process.exit(fails > 0 ? 1 : 0);

// ---------- helpers ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run" || a === "--draft") out[a.slice(2)] = true;
    else if (a.startsWith("--")) {
      out[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(2);
}

function loadPublishedSlugs() {
  if (!existsSync(STATE_FILE)) return new Set();
  const lines = readFileSync(STATE_FILE, "utf8").split("\n").filter(Boolean);
  return new Set(
    lines
      .map((l) => {
        try { return JSON.parse(l).slug; } catch { return null; }
      })
      .filter(Boolean)
  );
}

function appendPublished(record) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  appendFileSync(STATE_FILE, JSON.stringify(record) + "\n");
}

function isQualityCandidate(post) {
  if (!post.title || HAS_CJK.test(post.title)) return false;
  if ((post.content || "").trim().length < MIN_BODY_CHARS) return false;
  if (PERSONAL_TITLE_PATTERNS.some((re) => re.test(post.title))) return false;
  return true;
}

function readCandidates() {
  const files = readdirSync(BLOG_EN_DIR).filter((f) => f.endsWith(".mdx"));
  const posts = files.map((file) => {
    const raw = readFileSync(join(BLOG_EN_DIR, file), "utf8");
    const { data, content } = matter(raw);
    return {
      slug: data.slug || file.replace(/\.mdx$/, ""),
      title: data.title || "",
      date: data.date || "",
      tags: data.tags || [],
      source: data.source || "",
      content,
    };
  });
  const before = posts.length;
  const filtered = posts.filter(isQualityCandidate);
  console.log(
    `Quality filter: ${before} candidates → ${filtered.length} pass ` +
    `(min ${MIN_BODY_CHARS} chars, no CJK in title, no generic personal titles)`
  );
  // Sort by body length desc so the strongest articles publish first.
  filtered.sort((a, b) => (b.content?.length || 0) - (a.content?.length || 0));
  return filtered;
}

function normalizeTags(rawTags) {
  // Dev.to: lowercase, alphanumeric (+ hyphens), <= 4 tags, <= 30 chars each.
  const seen = new Set();
  const out = [];
  for (const t of rawTags || []) {
    const cleaned = String(t)
      .toLowerCase()
      .replace(/^#/, "")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 30);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
      if (out.length === 4) break;
    }
  }
  // Fallback if frontmatter had no usable tags.
  if (out.length === 0) return ["embedded", "programming", "ai"];
  return out;
}

// Replace every variant of the parent company's Chinese name / its
// pinyin transliteration with the overseas brand "Sienovo". The AI
// translation pipeline that produced these EN articles inconsistently
// rendered 深圳信迈 / 信迈 as "Xinmai" / "Shenzhen Xinmai" / left CJK
// in place; mixing those with our brand intro reads as confused
// branding to a Dev.to reader.
function normalizeBrand(text) {
  if (!text) return text;
  return text
    .replace(/深圳信迈/g, "Sienovo")
    .replace(/信迈/g, "Sienovo")
    .replace(/Shenzhen Xinmai/g, "Sienovo")
    .replace(/\bXinmai\b/g, "Sienovo");
}

function brandIntro() {
  // Single-line intro injected at the top of every Dev.to post so the
  // brand association is unambiguous even when the translated body
  // (mostly a stripped technical article from CSDN) contains no
  // mention of Sienovo on its own. The 深圳信迈 attribution lets
  // Chinese-speaking readers who know the parent company bridge to
  // the new English brand.
  return [
    `*Originally published on the [Sienovo Engineering Blog](${SITE_URL}/en/blog). ` +
    `Sienovo is the overseas brand of 深圳信迈 (Shenzhen Xinmai), ` +
    `building edge AI computing solutions for industrial video analytics.*`,
    "",
    "---",
    "",
  ].join("\n");
}

function aiDisclosureFooter(post) {
  const sienovoUrl = `${SITE_URL}/en/blog/${post.slug}`;
  return [
    "",
    "---",
    "",
    `*This article was translated from Chinese to English with AI assistance and a light human review. ` +
    `The original is published at [Sienovo Blog](${sienovoUrl}).` +
    (post.source ? ` The original Chinese source is at [CSDN](${post.source}).` : "") +
    ` Learn more about [Sienovo edge AI computing](${SITE_URL}).` +
    `*`,
    "",
  ].join("\n");
}

function buildArticlePayload(post) {
  const canonicalUrl = `${SITE_URL}/en/blog/${post.slug}`;
  const tags = normalizeTags(post.tags);
  const title = normalizeBrand(post.title);
  const body = brandIntro() + normalizeBrand(post.content.trim()) + aiDisclosureFooter(post);

  const article = {
    title,
    body_markdown: body,
    published: !DRAFT,
    canonical_url: canonicalUrl,
    tags,
  };
  if (ORG_ID) article.organization_id = Number(ORG_ID);

  return { article };
}

async function postArticle(payload) {
  try {
    const resp = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: {
        "api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "application/vnd.forem.api-v1+json",
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status} ${text.slice(0, 300)}` };
    }
    const data = JSON.parse(text);
    return { ok: true, id: data.id, url: data.url || data.canonical_url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function refreshArticle(slug) {
  // Look up the dev_to_id from our state log.
  if (!existsSync(STATE_FILE)) {
    console.error(`error: ${STATE_FILE} not found — nothing to refresh.`);
    return { ok: false };
  }
  const lines = readFileSync(STATE_FILE, "utf8").split("\n").filter(Boolean);
  let entry = null;
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      if (r.slug === slug) entry = r;
    } catch {}
  }
  if (!entry) {
    console.error(`error: slug "${slug}" not found in state log.`);
    return { ok: false };
  }

  // Re-read the local mdx and rebuild the payload with current intro/footer/normalize.
  const path = join(BLOG_EN_DIR, `${slug}.mdx`);
  if (!existsSync(path)) {
    console.error(`error: ${path} missing.`);
    return { ok: false };
  }
  const raw = readFileSync(path, "utf8");
  const { data, content } = matter(raw);
  const post = {
    slug: data.slug || slug,
    title: data.title || "",
    date: data.date || "",
    tags: data.tags || [],
    source: data.source || "",
    content,
  };
  const payload = buildArticlePayload(post);

  console.log(
    `Refreshing dev.to article ${entry.dev_to_id} (slug=${slug}, ` +
    `published=${payload.article.published})`
  );

  if (DRY_RUN) {
    console.log(`would PUT https://dev.to/api/articles/${entry.dev_to_id}`);
    console.log(`title: ${payload.article.title}`);
    console.log(`tags: ${payload.article.tags.join(", ")}`);
    console.log(`body length: ${payload.article.body_markdown.length}`);
    return { ok: true };
  }

  try {
    const resp = await fetch(`https://dev.to/api/articles/${entry.dev_to_id}`, {
      method: "PUT",
      headers: {
        "api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "application/vnd.forem.api-v1+json",
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error(`refresh failed: HTTP ${resp.status} ${text.slice(0, 300)}`);
      return { ok: false };
    }
    const data = JSON.parse(text);
    console.log(`✓ refreshed → ${data.url || data.canonical_url}`);
    return { ok: true };
  } catch (err) {
    console.error(`refresh failed: ${err.message}`);
    return { ok: false };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
