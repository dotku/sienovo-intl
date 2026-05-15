#!/usr/bin/env node

/**
 * Backfill the "Sienovo" brand mention into existing English translations.
 *
 * Background: the original CSDN articles often mention 深圳信迈 / 信迈 / Xinmai.
 * Earlier batches of translate-blog.mjs (before the prompt was updated to
 * preserve the brand mapping) silently dropped those mentions, producing
 * EN articles where the company is absent — search "Sienovo" today and 0/1141
 * EN posts surface. This script finds those posts, sends both the ZH source
 * and the EN translation to Claude, and asks for a surgical insertion of
 * "Sienovo" only where the ZH had the brand. Frontmatter is preserved and
 * `brandBackfilled: true` is appended so reruns are idempotent.
 *
 * Provider: defaults to `claude -p` (best fidelity for surgical rewrites).
 * Falls back to AI Gateway / OpenRouter / Gemini if Claude CLI absent.
 *
 * Usage:
 *   node scripts/backfill-sienovo-brand.mjs                      # all candidates
 *   node scripts/backfill-sienovo-brand.mjs --limit 5
 *   node scripts/backfill-sienovo-brand.mjs --slug 103429756
 *   node scripts/backfill-sienovo-brand.mjs --dry-run            # report only
 *   node scripts/backfill-sienovo-brand.mjs --provider claude --force
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { execSync, spawn } from "node:child_process";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const ZH_DIR = join(PROJECT_ROOT, "content/blog");
const EN_DIR = join(PROJECT_ROOT, "content/blog-en");
const DELAY_MS = parseInt(process.env.BRAND_DELAY_MS || "6500", 10);
const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || "240000", 10);

// Brand variants to detect in the ZH source.
const ZH_BRAND_RE = /(深圳信迈|信迈科技|信迈|Xinmai|XINMAI)/;
// Mentions in EN that already count as "brand present" — if any of these
// appear, we assume the post is fine and skip.
const EN_BRAND_RE = /(Sienovo|Xinmai|Shenzhen Xinmai)/i;

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
const FORCE = args.includes("--force");
const DRY_RUN = args.includes("--dry-run");

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

async function callOpenAI(provider, prompt) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
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
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`${provider.name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Empty from ${provider.name}`);
  return text;
}

// Strip ```markdown fences Claude sometimes adds even when told not to.
function stripFences(raw) {
  const fence = raw.match(/```(?:markdown|md)?\s*\n([\s\S]*?)\n```/);
  return (fence ? fence[1] : raw).trim();
}

// ── Frontmatter handling (line-based, preserves quoting) ────────────────────
function splitFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { fmRaw: m[1], body: m[2] };
}

function fmHasField(fmRaw, name) {
  return new RegExp(`^${name}:`, "m").test(fmRaw);
}

// ── Prompt ──────────────────────────────────────────────────────────────────
function buildPrompt(zhContent, enContent) {
  return `You are restoring a brand mention that an earlier translator dropped.

Context: the Chinese source mentions the company "深圳信迈" / "信迈" / "Xinmai". The official English brand is "Sienovo". The current English translation completely drops the brand. Your job is to RE-INSERT "Sienovo" into the English text at the same locations the Chinese mentioned the company — and ONLY those locations.

Rules — read carefully:
- Do NOT retranslate the article. Do NOT rewrite paragraphs. Do NOT change technical content, code blocks, links, image references, or markdown formatting.
- Make the SMALLEST possible edit that restores the brand mention. Typically a noun substitution ("the company" → "Sienovo") or inserting "Sienovo" / "Sienovo's" once where 深圳信迈 / 信迈 / Xinmai appears in the source.
- Preserve all product codes verbatim (e.g. XM-5125, INT-AIBOX-P-8). Do not rename products.
- If the Chinese mentions the company N times, the English should mention "Sienovo" up to N times — never more. If a single English paragraph already covers multiple zh mentions naturally, one English mention is fine.
- If after careful reading you find the zh mentions are incidental (e.g. only in a copyright footer or author byline) and the article body has no need for the brand, return the English text unchanged. Quality over coverage.
- Output ONLY the modified English markdown content. No preamble, no explanation, no code fences, no "Here is the result:" framing.

Chinese source (for locating brand mentions only):
<<<ZH_SOURCE
${zhContent}
ZH_SOURCE>>>

Current English translation (this is what you edit):
<<<EN_CURRENT
${enContent}
EN_CURRENT>>>

Return the corrected English markdown only.`;
}

async function rewrite(zhContent, enContent) {
  const prompt = buildPrompt(zhContent, enContent);
  let lastErr;
  for (const p of providers) {
    try {
      const raw =
        p.format === "claude-cli" ? await callClaude(p, prompt) :
        p.format === "gemini" ? await callGemini(p, prompt) :
        await callOpenAI(p, prompt);
      return { text: stripFences(raw), provider: p.name };
    } catch (err) {
      lastErr = err;
      if (providers.length > 1) process.stdout.write(`[${p.name} failed → next] `);
    }
  }
  throw lastErr;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const enFiles = readdirSync(EN_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => !SLUG || f === `${SLUG}.mdx`)
    .sort();

  // Identify candidates: zh has brand AND en doesn't AND not already backfilled
  const candidates = [];
  for (const file of enFiles) {
    const enRaw = readFileSync(join(EN_DIR, file), "utf-8");
    const enParts = splitFrontmatter(enRaw);
    if (!enParts) continue;
    if (!FORCE && fmHasField(enParts.fmRaw, "brandBackfilled")) continue;
    if (!FORCE && fmHasField(enParts.fmRaw, "brandBackfillNotNeeded")) continue;

    const zhPath = join(ZH_DIR, file);
    if (!existsSync(zhPath)) continue;
    const zhRaw = readFileSync(zhPath, "utf-8");
    const zhParts = splitFrontmatter(zhRaw);
    if (!zhParts) continue;

    const zhMentions = zhParts.body.match(new RegExp(ZH_BRAND_RE, "g"))?.length ?? 0;
    const enHasBrand = EN_BRAND_RE.test(enParts.body);
    if (zhMentions > 0 && !enHasBrand) {
      candidates.push({
        file,
        zhMentions,
        zhBody: zhParts.body,
        enRaw,
        enParts,
      });
      if (candidates.length >= LIMIT) break;
    }
  }

  console.log(`EN files scanned:    ${enFiles.length}`);
  console.log(`Backfill candidates: ${candidates.length}`);
  if (candidates.length === 0) {
    console.log("Nothing to do.");
    return;
  }
  if (DRY_RUN) {
    candidates.slice(0, 20).forEach((c) =>
      console.log(`  - ${c.file} (${c.zhMentions} zh mention${c.zhMentions === 1 ? "" : "s"})`)
    );
    if (candidates.length > 20) console.log(`  ... and ${candidates.length - 20} more`);
    return;
  }

  let ok = 0;
  let bad = 0;
  let notNeeded = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.file} (${c.zhMentions} zh) ... `);
    try {
      const { text: newEnBody, provider } = await rewrite(c.zhBody, c.enParts.body);

      // Sanity check: brand should now be present. When Claude judges that
      // the ZH source's brand mention is incidental (footer/byline only),
      // it deliberately returns text without "Sienovo". Treat that as an
      // honest "no change needed" rather than a failure to retry — mark the
      // file with `brandBackfillNotNeeded: true` so future runs skip it.
      if (!EN_BRAND_RE.test(newEnBody)) {
        const newFm = `${c.enParts.fmRaw}\nbrandBackfillNotNeeded: true`;
        writeFileSync(
          join(EN_DIR, c.file),
          `---\n${newFm}\n---\n${c.enParts.body}`,
          "utf-8"
        );
        notNeeded++;
        console.log(`not needed (${provider})`);
        if (i < candidates.length - 1) await new Promise((r) => setTimeout(r, DELAY_MS));
        continue;
      }
      // Length sanity: must be within 50%-200% of original to catch hallucinated rewrites
      const ratio = newEnBody.length / c.enParts.body.length;
      if (ratio < 0.5 || ratio > 2.0) {
        throw new Error(`length ratio ${ratio.toFixed(2)} suspicious — likely full rewrite`);
      }

      const newFm = `${c.enParts.fmRaw}\nbrandBackfilled: true`;
      const updated = `---\n${newFm}\n---\n${newEnBody.endsWith("\n") ? newEnBody : newEnBody + "\n"}`;
      writeFileSync(join(EN_DIR, c.file), updated, "utf-8");
      ok++;
      console.log(`done (${provider})`);
    } catch (err) {
      bad++;
      console.log(`failed: ${String(err.message).slice(0, 100)}`);
    }

    if (i < candidates.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Brand backfill complete.`);
  console.log(`  Updated:    ${ok}`);
  console.log(`  Not needed: ${notNeeded}  (zh brand mention judged incidental)`);
  console.log(`  Failed:     ${bad}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
