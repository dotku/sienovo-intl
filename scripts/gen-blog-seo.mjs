#!/usr/bin/env node

/**
 * Generate SEO-optimised <title> + <meta description> for English blog posts
 * and write them back into each MDX's frontmatter as `seoTitle` / `seoDescription`.
 *
 * Pipeline mirrors translate-blog.mjs:
 *   - prefer Vercel AI Gateway (cheap + reliable) → OpenRouter → Gemini Direct
 *   - paced at ~9 RPM to stay under Gemini free-tier 10 RPM
 *   - skips files that already have non-empty seoTitle in frontmatter (idempotent)
 *
 * Usage:
 *   node scripts/gen-blog-seo.mjs                   # all missing
 *   node scripts/gen-blog-seo.mjs --limit 20        # top 20 missing
 *   node scripts/gen-blog-seo.mjs --slug 103429756  # single post
 *   node scripts/gen-blog-seo.mjs --provider gateway --force   # rewrite even if present
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { execSync, spawn } from "node:child_process";
import matter from "gray-matter";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const TARGET_DIR = join(PROJECT_ROOT, "content/blog-en");
const DELAY_MS = parseInt(process.env.SEO_DELAY_MS || "6500", 10);
const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || "120000", 10);

function hasClaudeCLI() {
  try {
    execSync("command -v claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const PROVIDERS = {
  // Best quality. Subscription-backed `claude -p` headless CLI; auth is the
  // cached OAuth login from the local Claude Code install.
  claude: {
    name: "Claude (subscription)",
    format: "claude-cli",
    model: process.env.CLAUDE_MODEL || "sonnet",
    available: hasClaudeCLI(),
  },
  gateway: {
    name: "Vercel AI Gateway",
    url: "https://ai-gateway.vercel.sh/v1/chat/completions",
    key: process.env.AI_GATEWAY_API_KEY,
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
  gemini: {
    name: "Gemini Direct",
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    key: process.env.GEMINI_API_KEY,
    format: "gemini",
  },
};

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const LIMIT = argVal("--limit") ? parseInt(argVal("--limit"), 10) : Infinity;
const SLUG = argVal("--slug");
const FORCE_PROVIDER = argVal("--provider");
const FORCE_REWRITE = args.includes("--force");

const availableProviders = Object.entries(PROVIDERS)
  .filter(([, p]) => p.available ?? !!p.key)
  .map(([id, p]) => ({ id, ...p }));

if (availableProviders.length === 0) {
  console.error("No AI providers available. Install `claude` CLI or set AI_GATEWAY_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY.");
  process.exit(1);
}

const providers = FORCE_PROVIDER
  ? availableProviders.filter((p) => p.id === FORCE_PROVIDER)
  : availableProviders;

if (providers.length === 0) {
  console.error(`Provider "${FORCE_PROVIDER}" not available. Have: ${availableProviders.map((p) => p.id).join(", ")}`);
  process.exit(1);
}

console.log(`Providers (in fallback order): ${providers.map((p) => p.name).join(" → ")}`);

// ── Prompt ──────────────────────────────────────────────────────────────────
function buildPrompt({ title, tags, excerpt }) {
  return `You are an SEO copywriter for Sienovo (深圳信迈), an edge-AI / industrial computing company.

Write SEO metadata for the English blog article below. Output STRICT JSON, no prose, no code fences, exactly:
{"seoTitle":"...","seoDescription":"..."}

Rules:
- seoTitle: 50–60 characters, punchy, leads with the most-searched keyword, ends with " | Sienovo" only if it still fits within 60.
- seoDescription: 140–160 characters, one sentence, action-oriented, includes the primary keyword once, no clickbait, no emojis, no quotation marks inside.
- Use the article's actual technical topic. Don't invent products, numbers, or claims absent from the source.
- If the article is brand-related (mentions Sienovo or 深圳信迈), keep "Sienovo" naturally in copy. Otherwise omit.
- Plain ASCII only. No smart quotes.

Article title: ${title}
Tags: ${tags.join(", ") || "(none)"}
First ~600 chars:
${excerpt}`;
}

// ── Provider calls ──────────────────────────────────────────────────────────
async function callOpenAI(provider, prompt) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty from ${provider.name}`);
  return text;
}

async function callClaude(provider, prompt) {
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
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`${provider.name} exit ${code}: ${stderr.slice(0, 200) || stdout.slice(0, 200)}`));
      }
      const text = stdout.trim();
      if (!text) return reject(new Error(`Empty from ${provider.name}`));
      resolve(text);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function callGemini(provider, prompt) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 400, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Empty from ${provider.name}`);
  return text;
}

// Claude sometimes wraps JSON in ```json fences despite strict-JSON instructions.
function extractJSON(raw) {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : raw;
  const obj = candidate.match(/\{[\s\S]*\}/);
  return obj ? obj[0] : candidate;
}

async function generate(post) {
  const prompt = buildPrompt(post);
  let lastErr;
  for (const p of providers) {
    try {
      const raw =
        p.format === "claude-cli" ? await callClaude(p, prompt) :
        p.format === "gemini" ? await callGemini(p, prompt) :
        await callOpenAI(p, prompt);
      const parsed = JSON.parse(extractJSON(raw));
      if (typeof parsed.seoTitle !== "string" || typeof parsed.seoDescription !== "string") {
        throw new Error("missing seoTitle/seoDescription in JSON");
      }
      return { ...parsed, provider: p.name };
    } catch (err) {
      lastErr = err;
      if (providers.length > 1) process.stdout.write(`[${p.name} failed → next] `);
    }
  }
  throw lastErr;
}

// ── Excerpt builder (strip code/images, ~600 chars) ─────────────────────────
function makeExcerpt(content) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const files = readdirSync(TARGET_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => !SLUG || f === `${SLUG}.mdx`)
    .sort();

  if (files.length === 0) {
    console.log(SLUG ? `No file content/blog-en/${SLUG}.mdx` : "No translated posts found.");
    return;
  }

  // Build work list
  const work = [];
  for (const file of files) {
    const raw = readFileSync(join(TARGET_DIR, file), "utf-8");
    const { data } = matter(raw);
    const hasSEO = typeof data.seoTitle === "string" && data.seoTitle.length > 0;
    if (hasSEO && !FORCE_REWRITE) continue;
    work.push(file);
    if (work.length >= LIMIT) break;
  }

  console.log(`Files in /blog-en: ${files.length}`);
  console.log(`To process:       ${work.length}`);
  if (work.length === 0) {
    console.log("Nothing to do (use --force to rewrite existing).");
    return;
  }

  let ok = 0;
  let bad = 0;

  for (let i = 0; i < work.length; i++) {
    const file = work[i];
    process.stdout.write(`[${i + 1}/${work.length}] ${file} ... `);
    try {
      const filePath = join(TARGET_DIR, file);
      const raw = readFileSync(filePath, "utf-8");
      // Match the frontmatter block as raw text — we only want to APPEND
      // two new lines, not round-trip the whole YAML through gray-matter
      // (which silently rewrites quoting + list formatting and breaks the
      // line-based parsers in rewrite-for-linkedin.mjs / score-articles.mjs).
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!fmMatch) {
        console.log("skip (no frontmatter)");
        continue;
      }
      const { data, content } = matter(raw);
      const fmRaw = fmMatch[1];
      const body = fmMatch[2];

      if (!content || content.length < 200) {
        console.log("skip (too short)");
        continue;
      }

      const { seoTitle, seoDescription, provider } = await generate({
        title: data.title || "",
        tags: Array.isArray(data.tags) ? data.tags : [],
        excerpt: makeExcerpt(content),
      });

      const escape = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      // Drop any pre-existing lines so --force rewrites cleanly.
      const fmStripped = fmRaw
        .split("\n")
        .filter((l) => !/^seoTitle:/.test(l) && !/^seoDescription:/.test(l))
        .join("\n");
      const newFm =
        `${fmStripped}\n` +
        `seoTitle: "${escape(seoTitle.trim())}"\n` +
        `seoDescription: "${escape(seoDescription.trim())}"`;
      const updated = `---\n${newFm}\n---\n${body}`;

      writeFileSync(filePath, updated, "utf-8");
      ok++;
      console.log(`done (${provider}) — ${seoTitle.length}c / ${seoDescription.length}c`);
    } catch (err) {
      bad++;
      console.log(`failed: ${String(err.message).slice(0, 100)}`);
    }

    if (i < work.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`SEO metadata generation complete.`);
  console.log(`  Updated: ${ok}`);
  console.log(`  Failed:  ${bad}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
