#!/usr/bin/env node

/**
 * Expand thin English blog posts (< LOW_QUALITY_THRESHOLD chars) into
 * substantive technical content so they can be re-included in the sitemap.
 *
 * Reality check from sampling: the thin bucket (currently 245 posts, 500–1499c)
 * is a mix of:
 *   (a) genuine quick technical notes that have real content but are short —
 *       these CAN be honestly expanded with related context.
 *   (b) outlines / tables-of-contents / "see original article" stubs that have
 *       NO substance — expanding these would just be hallucinated filler,
 *       worse than leaving them noindex.
 *
 * We let Claude self-classify each post. If the model judges the post is a
 * stub it returns the literal token `SKIP` and we mark `expandSkipped: true`
 * so future runs leave it alone. If expandable, the model returns the new
 * markdown body and we replace the article body and set `expanded: true`.
 *
 * Provider: defaults to `claude -p` (subscription auth). Falls back through
 * gateway → openrouter → gemini if Claude CLI is absent.
 *
 * Usage:
 *   node scripts/expand-thin-posts.mjs                  # all thin candidates
 *   node scripts/expand-thin-posts.mjs --limit 5
 *   node scripts/expand-thin-posts.mjs --slug 19809689
 *   node scripts/expand-thin-posts.mjs --dry-run
 *   node scripts/expand-thin-posts.mjs --provider claude --force
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { execSync, spawn } from "node:child_process";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
config({ path: join(PROJECT_ROOT, ".env.local") });

const ZH_DIR = join(PROJECT_ROOT, "content/blog");
const EN_DIR = join(PROJECT_ROOT, "content/blog-en");
const DELAY_MS = parseInt(process.env.EXPAND_DELAY_MS || "8000", 10);
const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || "300000", 10);

// Mirror lib/blog.ts. Anything below this is excluded from sitemap and
// marked noindex; we target the upper end of that bucket where real content
// is most likely to exist.
const THRESHOLD = 1500;
// Anything below this is almost certainly a stub/link-only — skip outright,
// don't even spend a Claude call on it.
const HARD_FLOOR = 0;
// Target body length after expansion. Pushes posts comfortably above the
// noindex threshold without bloating the prompt.
const TARGET_LEN = 2200;

function hasClaudeCLI() {
  try {
    execSync("command -v claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const PROVIDERS = {
  claude: {
    name: "Claude (subscription)",
    format: "claude-cli",
    model: process.env.CLAUDE_MODEL || "sonnet",
    available: hasClaudeCLI(),
  },
  // GitHub Models — uses MODELS_TOKEN (or GITHUB_TOKEN in Actions) with
  // `models:read` scope. OpenAI-compatible endpoint, generous free tier,
  // ideal for GH Actions where Claude OAuth isn't available.
  "github-models": {
    name: "GitHub Models",
    url: "https://models.github.ai/inference/chat/completions",
    key: process.env.MODELS_TOKEN || process.env.GITHUB_TOKEN,
    model: process.env.GITHUB_MODELS_MODEL || "openai/gpt-4o-mini",
    format: "openai",
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
  cerebras: {
    name: "Cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    key: process.env.CEREBRAS_API_KEY,
    model: process.env.CEREBRAS_MODEL || "gpt-oss-120b",
    format: "openai",
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
const FORCE = args.includes("--force");
const DRY_RUN = args.includes("--dry-run");
const LOCALE = argVal("--locale") || "en";
const TARGET_DIR = LOCALE === "zh" ? ZH_DIR : EN_DIR;

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

console.log(`Providers: ${providers.map((p) => p.name).join(" → ")}`);
if (DRY_RUN) console.log("(dry-run — no files will be written)");

// ── Provider call helpers ───────────────────────────────────────────────────
async function callClaude(provider, prompt) {
  return new Promise((resolve, reject) => {
    const cliArgs = ["-p"];
    if (provider.model) cliArgs.push("--model", provider.model);
    const child = spawn("claude", cliArgs, { stdio: ["pipe", "pipe", "pipe"] });
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
      if (code !== 0) return reject(new Error(`${provider.name} exit ${code}: ${stderr.slice(0, 200) || stdout.slice(0, 200)}`));
      const text = stdout.trim();
      if (!text) return reject(new Error(`Empty from ${provider.name}`));
      resolve(text);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function callOpenAI(provider, prompt) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Empty from ${provider.name}`);
  return text;
}

async function callGemini(provider, prompt) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Empty from ${provider.name}`);
  return text;
}

function stripFences(raw) {
  const fence = raw.match(/```(?:markdown|md)?\s*\n([\s\S]*?)\n```/);
  return (fence ? fence[1] : raw).trim();
}

// ── Frontmatter handling (line-based, preserves quoting) ────────────────────
function splitFrontmatter(raw) {
  const normalized = raw.replace(/\r\n/g, "\n");
  const m = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { fmRaw: m[1], body: m[2] };
}
function fmHasField(fmRaw, name) {
  return new RegExp(`^${name}:`, "m").test(fmRaw);
}
function readField(fmRaw, name) {
  const m = fmRaw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  if (!m) return "";
  let v = m[1].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  return v;
}
function readTags(fmRaw) {
  const m = fmRaw.match(/^tags:\s*\[(.+)\]\s*$/m);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

// ── Prompt ──────────────────────────────────────────────────────────────────
function buildPrompt({ title, tags, zhBody, enBody, locale }) {
  const isChinese = locale === "zh";
  const targetLang = isChinese ? "Chinese (Simplified)" : "English";
  const sourceBody = isChinese ? zhBody : enBody;

  return `You are a senior technical writer for Sienovo, an edge-AI / industrial computing company. You are expanding a thin blog post originally from a Chinese CSDN article.

CRITICAL: First decide whether this article has substantive technical content worth expanding, or whether it is just an outline / table-of-contents / "see original" stub.

If the article is a stub (e.g. just a list of section titles with no actual content, just a link to the original, or otherwise has no real technical material to anchor an expansion on), output EXACTLY this single token and nothing else:
SKIP

If the article has real content (a debugging note, a code-walkthrough, a how-to, a comparison, a troubleshooting tip — even a short one), then expand it into a substantive ${TARGET_LEN}+ character blog post:
- IMPORTANT: Write the entire expanded article in ${targetLang}.
- Stay 100% truthful to the original technical content. Do NOT invent product names, version numbers, benchmark numbers, performance claims, or specific behaviour the source did not state.
- You may add commonly-known background context for the technology (e.g. "AM5728 is a TI Sitara processor with dual ARM Cortex-A15 cores"), step-by-step elaboration, and standard troubleshooting hints, as long as those are domain knowledge a competent engineer would already know.
- Preserve the original article's specific findings/observations exactly. The expansion goes around them, not on top of them.
- Keep all code blocks, commands, file paths, error messages, and link references unchanged.
- Use markdown headings (##) to add structure if helpful.
- The first paragraph should be a useful intro that names the topic and what the reader will learn.
- Output ONLY the expanded markdown body. No frontmatter, no preamble, no code fences wrapping the whole output, no "Here is the expanded article:" framing.

Article title: ${title}
Tags: ${tags.join(", ") || "(none)"}

Source body:
<<<SOURCE
${sourceBody}
SOURCE>>>

Decide: SKIP, or expanded markdown body in ${targetLang}.`;
}

async function expand(post) {
  const prompt = buildPrompt(post);
  let lastErr;
  for (const p of providers) {
    try {
      const raw =
        p.format === "claude-cli" ? await callClaude(p, prompt) :
        p.format === "gemini" ? await callGemini(p, prompt) :
        await callOpenAI(p, prompt);
      const text = stripFences(raw);
      return { text, provider: p.name };
    } catch (err) {
      lastErr = err;
      if (providers.length > 1) process.stdout.write(`[${p.name} failed → next] `);
    }
  }
  throw lastErr;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const enFiles = readdirSync(TARGET_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => !SLUG || f === `${SLUG}.mdx`)
    .sort();

  const candidates = [];
  for (const file of enFiles) {
    const enRaw = readFileSync(join(TARGET_DIR, file), "utf-8");
    const enParts = splitFrontmatter(enRaw);
    if (!enParts) continue;
    if (!FORCE) {
      if (fmHasField(enParts.fmRaw, "expanded")) continue;
      if (fmHasField(enParts.fmRaw, "expandSkipped")) continue;
    }
    const len = enParts.body.trim().length;
    if (len >= THRESHOLD) continue;
    if (len < HARD_FLOOR) continue; // truly empty stub — leave alone

    const zhPath = join(ZH_DIR, file);
    const zhBody = existsSync(zhPath)
      ? (splitFrontmatter(readFileSync(zhPath, "utf-8"))?.body ?? "")
      : "";

    candidates.push({
      file,
      enRaw,
      enParts,
      zhBody,
      title: readField(enParts.fmRaw, "title"),
      tags: readTags(enParts.fmRaw),
      enLen: len,
    });
    if (candidates.length >= LIMIT) break;
  }

  console.log(`Files scanned (${LOCALE}): ${enFiles.length}`);
  console.log(`Thin candidates [${HARD_FLOOR}-${THRESHOLD - 1}c]: ${candidates.length}`);
  if (candidates.length === 0) {
    console.log("Nothing to expand.");
    return;
  }
  if (DRY_RUN) {
    candidates.slice(0, 20).forEach((c) =>
      console.log(`  - ${c.file} (${c.enLen}c)  "${c.title.slice(0, 60)}"`)
    );
    if (candidates.length > 20) console.log(`  ... and ${candidates.length - 20} more`);
    return;
  }

  let expanded = 0;
  let skipped = 0;
  let bad = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.file} (${c.enLen}c) ... `);
    try {
      const { text: result, provider } = await expand({
        title: c.title,
        tags: c.tags,
        zhBody: c.zhBody.slice(0, 8000),
        enBody: c.enParts.body,
        locale: LOCALE,
      });

      if (result.trim() === "SKIP") {
        const newFm = `${c.enParts.fmRaw}\nexpandSkipped: true`;
        writeFileSync(join(TARGET_DIR, c.file), `---\n${newFm}\n---\n${c.enParts.body}`, "utf-8");
        skipped++;
        console.log(`SKIP (${provider})`);
        if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
        continue;
      }

      const newLen = result.length;
      if (newLen < 500) {
        throw new Error(`expansion only ${newLen}c, below 500 threshold`);
      }
      if (newLen / c.enLen > 50) {
        throw new Error(`length ratio ${(newLen / c.enLen).toFixed(0)}x — likely hallucinated`);
      }

      const newFm = `${c.enParts.fmRaw}\nexpanded: true`;
      const updated = `---\n${newFm}\n---\n${result.endsWith("\n") ? result : result + "\n"}`;
      writeFileSync(join(TARGET_DIR, c.file), updated, "utf-8");
      expanded++;
      console.log(`done (${provider}) — ${c.enLen}c → ${newLen}c`);
    } catch (err) {
      bad++;
      console.log(`failed: ${String(err.message).slice(0, 100)}`);
    }

    if (i < candidates.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Thin-post expansion complete.`);
  console.log(`  Expanded: ${expanded}`);
  console.log(`  Skipped:  ${skipped}  (model classified as stub)`);
  console.log(`  Failed:   ${bad}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
