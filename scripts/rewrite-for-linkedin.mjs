#!/usr/bin/env node

/**
 * Rewrite a translated MDX blog post into a LinkedIn-ready post.
 * Uses existing Gemini pipeline (same providers as translate-blog.mjs).
 *
 * Input:  content/blog-en/{id}.mdx      (must already be translated)
 *         content/blog/{id}.mdx         (for tags)
 * Output: data/posts/{id}.json          (ready to publish via Buffer)
 *
 * Usage:
 *   node scripts/rewrite-for-linkedin.mjs --id 134104142
 *   node scripts/rewrite-for-linkedin.mjs --ids 134104142,147628038,141399982
 *   node scripts/rewrite-for-linkedin.mjs --approved          # rewrite all in data/approved.txt
 *   node scripts/rewrite-for-linkedin.mjs --approved --force  # overwrite existing
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { config } from "dotenv";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const BLOG_CN_DIR = join(PROJECT_ROOT, "content/blog");
const BLOG_EN_DIR = join(PROJECT_ROOT, "content/blog-en");
const POSTS_DIR = join(PROJECT_ROOT, "data/posts");
const APPROVED_FILE = join(PROJECT_ROOT, "data/approved.txt");

const SIENOVO_BLOG_URL = process.env.REPLACE_WITH_BLOG_URL || "https://sienovo.jytech.us/blog";

mkdirSync(POSTS_DIR, { recursive: true });

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const ID = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
const IDS = args.includes("--ids") ? args[args.indexOf("--ids") + 1]?.split(",") : null;
const USE_APPROVED = args.includes("--approved");
const FORCE = args.includes("--force");

// ── Provider chain (same as translate-blog.mjs) ─────────────────────────────
const PROVIDERS = {
  gemini: {
    name: "Gemini Direct",
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    key: process.env.GEMINI_API_KEY,
    format: "gemini",
  },
  gateway: {
    name: "Vercel AI Gateway",
    url: "https://ai-gateway.vercel.sh/v1/chat/completions",
    key: process.env.VERCEL_AI_GEWAY_API_KEY,
    model: "google/gemini-2.5-flash",
    format: "openai",
  },
  openrouter: {
    name: "OpenRouter Gemini",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_API_KEY,
    model: "google/gemini-2.5-flash",
    format: "openai",
  },
};

const availableProviders = Object.entries(PROVIDERS)
  .filter(([, p]) => p.key)
  .map(([id, p]) => ({ id, ...p }));

if (availableProviders.length === 0) {
  console.error("No AI API keys found. Set GEMINI_API_KEY, VERCEL_AI_GEWAY_API_KEY, or OPENROUTER_API_KEY.");
  process.exit(1);
}

// ── Frontmatter parser ──────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    else if (v.startsWith("[") && v.endsWith("]")) {
      v = v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    fm[kv[1]] = v;
  }
  return { fm, body: m[2].trim() };
}

function stripMarkdown(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")     // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // links → text
    .replace(/^#+\s+/gm, "")                   // headings
    .replace(/[*_`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstImage(md) {
  const m = md.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/);
  return m ? m[1] : null;
}

// ── Prompt ──────────────────────────────────────────────────────────────────
const SYSTEM_STYLE_GUIDE = `You are a LinkedIn content strategist writing for JYTech LLC, a hardware engineering company that sells industrial boards (AI boxes, PCIe switches, DSP/FPGA systems, energy management controllers) to international B2B buyers under the "Sienovo" product line.

Voice: confident, practical, technically credible. Write like an engineer explaining to other engineers, not a marketer.

Target audience: engineers, CTOs, procurement managers at BESS operators, industrial integrators, defense contractors, energy companies in North America, Europe, SE Asia.

CRITICAL CONSTRAINTS:
- NEVER use "domestic alternative", "replaces [foreign brand]", "import substitution", or similar framing. Positioning is "capable, cost-effective, compatible" — not "Chinese-made alternative".
- AVOID brand-name-vs-brand-name framing ("our chip vs Broadcom/NVIDIA"). Instead emphasize interoperability and standards.
- Skip generic marketing fluff ("cutting-edge", "revolutionary", "game-changing").
- Use concrete specs, numbers, protocols (PCIe 5.0, SR-IOV, EtherCAT, Modbus, etc.) when present in source.

STRUCTURE (must follow exactly):
1. Hook — 1-2 sentences that create curiosity or tension. NO intro like "In this post" or "Today I want to talk about". Start with a sharp observation or counter-intuitive claim.
2. Lead — one sentence stating what the post delivers.
3. Body — 3-5 bullets using emoji prefixes (⚡ 📊 🔄 🛡️ 🎯 ⚙️ 🔧 etc). Each bullet: short noun phrase + concrete detail, max 2 lines.
4. Insight — 1-2 sentences of "why this matters" for the target buyer.
5. Product mention — ONE natural sentence: "Our team at JYTech has been building X on this architecture through our Sienovo product line." Vary the wording per post to avoid repetition.
6. Link CTA — "Full write-up: {URL}" or similar, on its own line.
7. Engagement prompt — one short question inviting replies.
8. Hashtags — 4-6 lowercase-optional hashtags (e.g. #EnergyStorage #EdgeComputing). Use hashtags the TARGET audience searches for, not Chinese terms.

LENGTH: Aim for 1200-1900 characters total. Never exceed 2800.

OUTPUT FORMAT: Return ONLY the post text — no JSON, no commentary, no headers. No "Here is your post:" preamble.`;

function buildPrompt(title, tags, body, url) {
  return `${SYSTEM_STYLE_GUIDE}

---
SOURCE ARTICLE TO ADAPT

Title: ${title}
Tags: ${Array.isArray(tags) ? tags.join(", ") : tags}
Target URL: ${url}

Body:
${body.slice(0, 6000)}

---

Now produce the LinkedIn post following the structure above. The URL to include is: ${url}`;
}

// ── Call provider ───────────────────────────────────────────────────────────
async function callOpenAI(provider, prompt) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callGemini(provider, prompt) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

async function rewriteWithAI(prompt) {
  let lastErr;
  for (const p of availableProviders) {
    try {
      const text = p.format === "gemini" ? await callGemini(p, prompt) : await callOpenAI(p, prompt);
      if (text && text.length > 200) return { text, provider: p.name };
      throw new Error(`response too short (${text?.length} chars)`);
    } catch (err) {
      lastErr = err;
      process.stdout.write(`[${p.name} failed: ${err.message.slice(0, 50)}] `);
    }
  }
  throw lastErr;
}

// ── Per-article rewrite ─────────────────────────────────────────────────────
async function rewriteOne(id) {
  const outPath = join(POSTS_DIR, `${id}.json`);
  if (!FORCE && existsSync(outPath)) {
    console.log(`[${id}] ✓ already exists (use --force to overwrite)`);
    return;
  }

  const enPath = join(BLOG_EN_DIR, `${id}.mdx`);
  const cnPath = join(BLOG_CN_DIR, `${id}.mdx`);

  if (!existsSync(enPath)) {
    console.log(`[${id}] ✗ no EN translation (run translate-blog.mjs first)`);
    return;
  }

  const enRaw = readFileSync(enPath, "utf-8");
  const parsed = parseFrontmatter(enRaw);
  if (!parsed) {
    console.log(`[${id}] ✗ bad frontmatter`);
    return;
  }
  const { fm, body } = parsed;

  let tags = fm.tags || [];
  if (existsSync(cnPath)) {
    const cnParsed = parseFrontmatter(readFileSync(cnPath, "utf-8"));
    if (cnParsed?.fm.tags) tags = cnParsed.fm.tags;
  }

  const plainBody = stripMarkdown(body);
  const image = firstImage(body);
  const articleUrl = `${SIENOVO_BLOG_URL.replace(/\/$/, "")}/${id}`;

  process.stdout.write(`[${id}] rewriting... `);
  const { text, provider } = await rewriteWithAI(buildPrompt(fm.title, tags, plainBody, articleUrl));

  const post = {
    article_id: id,
    title_en: fm.title,
    tags,
    source_url: articleUrl,
    text,
    link: articleUrl,
    image,
    rewritten_at: new Date().toISOString(),
    rewritten_by: provider,
  };

  writeFileSync(outPath, JSON.stringify(post, null, 2), "utf-8");
  console.log(`✓ ${provider} (${text.length} chars) → ${outPath}`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  let ids = [];
  if (ID) ids = [ID];
  else if (IDS) ids = IDS;
  else if (USE_APPROVED) {
    if (!existsSync(APPROVED_FILE)) {
      console.error(`Missing ${APPROVED_FILE}. Create it with one article ID per line.`);
      process.exit(1);
    }
    ids = readFileSync(APPROVED_FILE, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } else {
    console.log("Usage:");
    console.log("  --id <id>              rewrite one article");
    console.log("  --ids id1,id2,id3      rewrite specific articles");
    console.log("  --approved             rewrite all in data/approved.txt");
    console.log("  --force                overwrite existing data/posts/{id}.json");
    process.exit(0);
  }

  console.log(`Processing ${ids.length} article(s) with providers: ${availableProviders.map((p) => p.name).join(", ")}`);
  console.log("");

  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    try {
      await rewriteOne(id);
      ok++;
    } catch (err) {
      console.log(`[${id}] ✗ ${err.message.slice(0, 80)}`);
      fail++;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log("");
  console.log("=".repeat(60));
  console.log(`Rewritten: ${ok},  Failed: ${fail}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
