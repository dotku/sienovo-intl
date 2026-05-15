#!/usr/bin/env node

/**
 * Translate Chinese blog articles to English using multiple AI providers.
 * Supports: Vercel AI Gateway, OpenRouter, Gemini (fallback chain).
 * Reads from content/blog/, writes to content/blog-en/.
 * Skips articles that already have translations.
 *
 * Usage:
 *   node scripts/translate-blog.mjs              # translate all untranslated
 *   node scripts/translate-blog.mjs --limit 10   # translate up to 10 articles
 *   node scripts/translate-blog.mjs --provider gemini   # force a specific provider
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { execSync, spawn } from "node:child_process";

// ── Load .env.local ─────────────────────────────────────────────────────────
const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

// ── Config ──────────────────────────────────────────────────────────────────
const SOURCE_DIR = join(PROJECT_ROOT, "content/blog");
const TARGET_DIR = join(PROJECT_ROOT, "content/blog-en");
const DELAY_MS = parseInt(process.env.TRANSLATE_DELAY_MS || "6500", 10); // Pace at ~9 RPM to stay under Gemini free-tier 10 RPM limit
const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || "180000", 10);

function hasClaudeCLI() {
  try {
    execSync("command -v claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ── Provider definitions ────────────────────────────────────────────────────
const PROVIDERS = {
  // Best quality: Claude via the subscription-backed `claude -p` headless CLI.
  // Auth comes from the cached OAuth login (no env key needed). Subject to
  // the user's subscription rate limits (5h rolling window).
  claude: {
    name: "Claude (subscription)",
    format: "claude-cli",
    model: process.env.CLAUDE_MODEL || "sonnet",
    available: hasClaudeCLI(),
  },
  // GitHub Models — uses MODELS_TOKEN (or GITHUB_TOKEN in Actions) with the
  // `models:read` scope. OpenAI-compatible endpoint, generous free tier,
  // gpt-4o-mini is the sweet spot for technical CN→EN translation: solid
  // quality, fast, low rate-limit pressure. Override via GITHUB_MODELS_MODEL
  // (e.g. "openai/gpt-4o" for top quality, "openai/gpt-5-mini" once GA'd).
  "github-models": {
    name: "GitHub Models",
    url: "https://models.github.ai/inference/chat/completions",
    key: process.env.MODELS_TOKEN || process.env.GITHUB_TOKEN,
    model: process.env.GITHUB_MODELS_MODEL || "openai/gpt-4o-mini",
    format: "openai",
  },
  // Daily sync: Gemini 2.5 Flash free tier — 10 RPM, 250 RPD (as of 2025)
  gemini: {
    name: "Gemini Direct",
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    key: process.env.GEMINI_API_KEY,
    model: "gemini-2.5-flash",
    format: "gemini",
  },
  // Fallback: Vercel AI Gateway (uses credits, reliable for bulk)
  gateway: {
    name: "Vercel AI Gateway",
    url: "https://ai-gateway.vercel.sh/v1/chat/completions",
    key: process.env.AI_GATEWAY_API_KEY,
    model: "google/gemini-2.5-flash",
    format: "openai",
  },
  // Fallback: OpenRouter
  openrouter: {
    name: "OpenRouter Gemini",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_API_KEY,
    model: "google/gemini-2.5-flash",
    format: "openai",
  },
};

// Build provider chain: prefer claude > github-models > gateway > openrouter > gemini.
// Claude has no env key — its `available` flag is set when the CLI is
// installed; everything else gates on a key.
const availableProviders = Object.entries(PROVIDERS)
  .filter(([, p]) => p.available ?? !!p.key)
  .map(([id, p]) => ({ id, ...p }));

if (availableProviders.length === 0) {
  console.error("No AI providers available. Install `claude` CLI or set AI_GATEWAY_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY.");
  process.exit(1);
}

console.log(`Available providers: ${availableProviders.map((p) => p.name).join(", ")}`);

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : Infinity;
const FORCE_PROVIDER = args.includes("--provider")
  ? args[args.indexOf("--provider") + 1]
  : null;

// ── Translation via OpenAI-compatible API ──────────────────────────────────
async function translateOpenAI(provider, prompt) {
  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
      ...(provider.extraBody || {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${provider.name} error ${response.status}: ${err.substring(0, 120)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty response from ${provider.name}`);
  return text;
}

// ── Translation via Claude headless CLI (subscription auth) ────────────────
async function translateClaude(provider, prompt) {
  return new Promise((resolve, reject) => {
    const args = ["-p"];
    if (provider.model) args.push("--model", provider.model);
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${provider.name} timed out after ${CLAUDE_TIMEOUT_MS}ms`));
    }, CLAUDE_TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`${provider.name} exit ${code}: ${stderr.slice(0, 200) || stdout.slice(0, 200)}`));
      }
      const text = stdout.trim();
      if (!text) return reject(new Error(`Empty response from ${provider.name}`));
      resolve(text);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ── Translation via Gemini native API ──────────────────────────────────────
async function translateGemini(provider, prompt) {
  const response = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${provider.name} error ${response.status}: ${err.substring(0, 120)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Empty response from ${provider.name}`);
  return text;
}

// ── Translate with fallback chain ──────────────────────────────────────────
async function translate(title, tags, content) {
  const prompt = `You are a professional technical translator. Translate the following Chinese technical blog post to English.

Rules:
- Translate naturally, not word-by-word. Use proper English technical terminology.
- Keep all markdown formatting, code blocks, and image references exactly as-is.
- Keep all URLs unchanged.
- Do NOT add any commentary or explanation — only return the translated content.
- If the text is already in English, return it unchanged.

Brand handling (important):
- Render the company name 深圳信迈 (or any 信迈 / Xinmai / Shenzhen Xinmai variant) as "Sienovo" — Sienovo is the official overseas English brand of 深圳信迈.
- Preserve product codes verbatim (e.g. XM-5125 stays XM-5125, INT-AIBOX-P-8 stays as-is). Only the company name swaps to Sienovo; do not rename products.
- If the article is about 深圳信迈 generally, the translated text should refer to "Sienovo" throughout.

Tags handling:
- Translate each tag to a short English equivalent. Keep the leading # if present. Use camel case for multi-word tags (e.g. #人工智能 → #AI, #fpga开发 → #FPGADev, #工业物联网 → #IIoT).
- Preserve tags that are already English (e.g. "#AM5728") unchanged.
- Return tags as a JSON array on a single line prefixed with "Tags: " — e.g.: Tags: ["#AI", "#FPGADev"]

Output format (strict, in this order):
Title: <translated title>
Tags: <JSON array of translated tags>
Content:
<translated markdown content>

---
Title: ${title}
Tags: ${tags}

Content:
${content}`;

  const providers = FORCE_PROVIDER
    ? availableProviders.filter((p) => p.id === FORCE_PROVIDER)
    : availableProviders;

  if (providers.length === 0) {
    throw new Error(`Provider "${FORCE_PROVIDER}" not available`);
  }

  let lastError;
  for (const provider of providers) {
    try {
      const result =
        provider.format === "claude-cli" ? await translateClaude(provider, prompt) :
        provider.format === "gemini" ? await translateGemini(provider, prompt) :
        await translateOpenAI(provider, prompt);
      return { text: result, provider: provider.name };
    } catch (err) {
      lastError = err;
      if (providers.length > 1) {
        process.stdout.write(`[${provider.name} failed, trying next] `);
      }
    }
  }
  throw lastError;
}

// ── Parse translated response ───────────────────────────────────────────────
function parseTranslation(translatedText, originalFrontmatter) {
  const lines = translatedText.trim().split("\n");
  let translatedTitle = originalFrontmatter.title;
  let translatedTags = originalFrontmatter.tags; // raw "..,.." string fallback
  let i = 0;

  // Title:
  if (lines[i]?.startsWith("Title:")) {
    translatedTitle = lines[i].replace(/^Title:\s*/, "").trim();
    i++;
  }
  // Tags:
  if (lines[i]?.startsWith("Tags:")) {
    const tagsLine = lines[i].replace(/^Tags:\s*/, "").trim();
    try {
      const parsed = JSON.parse(tagsLine);
      if (Array.isArray(parsed)) {
        translatedTags = parsed
          .map((t) => `"${String(t).replace(/"/g, '\\"')}"`)
          .join(", ");
      }
    } catch {
      // leave fallback
    }
    i++;
  }
  // skip optional separators / "Content:" header
  while (
    i < lines.length &&
    (lines[i].trim() === "" ||
      lines[i].trim() === "---" ||
      lines[i].startsWith("Content:"))
  ) {
    i++;
  }
  const translatedContent = lines.slice(i).join("\n").trim();

  return { translatedTitle, translatedTags, translatedContent };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(TARGET_DIR, { recursive: true });

  // Get source articles
  const sourceFiles = readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .sort();

  // Get already translated
  const translated = new Set(
    existsSync(TARGET_DIR)
      ? readdirSync(TARGET_DIR)
          .filter((f) => f.endsWith(".mdx"))
          .map((f) => f)
      : []
  );

  // Find untranslated
  const untranslated = sourceFiles.filter((f) => !translated.has(f));
  const toProcess = untranslated.slice(0, LIMIT);

  console.log(`Source articles: ${sourceFiles.length}`);
  console.log(`Already translated: ${translated.size}`);
  console.log(`To translate: ${toProcess.length}`);

  if (toProcess.length === 0) {
    console.log("Nothing to translate.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const file = toProcess[i];
    const id = file.replace(/\.mdx$/, "");

    try {
      process.stdout.write(
        `[${i + 1}/${toProcess.length}] ${id} ... `
      );

      const raw = readFileSync(join(SOURCE_DIR, file), "utf-8");

      // Parse frontmatter
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!fmMatch) {
        console.log("skip (no frontmatter)");
        failed++;
        continue;
      }

      const frontmatterStr = fmMatch[1];
      const content = fmMatch[2].trim();

      // Parse frontmatter fields
      const titleMatch = frontmatterStr.match(/title:\s*"(.+?)"/);
      const dateMatch = frontmatterStr.match(/date:\s*"(.+?)"/);
      const slugMatch = frontmatterStr.match(/slug:\s*"(.+?)"/);
      const tagsMatch = frontmatterStr.match(/tags:\s*\[(.+?)\]/);
      const sourceMatch = frontmatterStr.match(/source:\s*"(.+?)"/);

      const fm = {
        title: titleMatch?.[1] || "",
        date: dateMatch?.[1] || "",
        slug: slugMatch?.[1] || id,
        tags: tagsMatch?.[1] || "",
        source: sourceMatch?.[1] || "",
      };

      if (!content || content.length < 20) {
        console.log("skip (too short)");
        failed++;
        continue;
      }

      // Translate
      const { text: translatedText, provider: usedProvider } = await translate(fm.title, fm.tags, content);
      const { translatedTitle, translatedTags, translatedContent } = parseTranslation(translatedText, fm);

      // Write translated MDX
      const mdx = `---
title: "${translatedTitle.replace(/"/g, '\\"')}"
date: "${fm.date}"
slug: "${fm.slug}"
tags: [${translatedTags}]
source: "${fm.source}"
originalTitle: "${fm.title.replace(/"/g, '\\"')}"
---

${translatedContent}
`;

      writeFileSync(join(TARGET_DIR, file), mdx, "utf-8");
      success++;
      console.log(`done (${usedProvider})`);
    } catch (err) {
      failed++;
      console.log(`failed: ${err.message.substring(0, 60)}`);
    }

    // Rate limiting
    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Translation complete!`);
  console.log(`  Translated: ${success}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Output dir: ${TARGET_DIR}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
