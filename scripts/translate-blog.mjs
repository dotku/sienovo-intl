#!/usr/bin/env node

/**
 * Translate Chinese blog articles to English using Gemini API.
 * Reads from content/blog/, writes to content/blog-en/.
 * Skips articles that already have translations.
 *
 * Usage:
 *   node scripts/translate-blog.mjs              # translate all untranslated
 *   node scripts/translate-blog.mjs --limit 10   # translate up to 10 articles
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

// ── Load .env.local ─────────────────────────────────────────────────────────
const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

// ── Config ──────────────────────────────────────────────────────────────────
const SOURCE_DIR = join(PROJECT_ROOT, "content/blog");
const TARGET_DIR = join(PROJECT_ROOT, "content/blog-en");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DELAY_MS = 1500; // Rate limiting between API calls
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY env var.");
  process.exit(1);
}

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : Infinity;

// ── Gemini translation ─────────────────────────────────────────────────────
async function translateWithGemini(title, content) {
  const prompt = `You are a professional technical translator. Translate the following Chinese technical blog post to English.

Rules:
- Translate naturally, not word-by-word. Use proper English technical terminology.
- Keep all markdown formatting, code blocks, and image references exactly as-is.
- Keep all URLs unchanged.
- Do NOT add any commentary or explanation — only return the translated content.
- If the text is already in English, return it unchanged.

---
Title: ${title}

Content:
${content}`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from Gemini");
  }
  return text;
}

// ── Parse translated response ───────────────────────────────────────────────
function parseTranslation(translatedText, originalFrontmatter) {
  // The response might include a translated title line — extract it
  const lines = translatedText.trim().split("\n");
  let translatedTitle = originalFrontmatter.title;
  let translatedContent = translatedText.trim();

  // Check if Gemini returned "Title: ..." at the start
  if (lines[0].startsWith("Title:")) {
    translatedTitle = lines[0].replace(/^Title:\s*/, "").trim();
    // Skip the title line and any separator
    let startIdx = 1;
    if (lines[startIdx]?.trim() === "" || lines[startIdx]?.trim() === "---") startIdx++;
    if (lines[startIdx]?.startsWith("Content:")) startIdx++;
    if (lines[startIdx]?.trim() === "") startIdx++;
    translatedContent = lines.slice(startIdx).join("\n").trim();
  }

  return { translatedTitle, translatedContent };
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
      const translated = await translateWithGemini(fm.title, content);
      const { translatedTitle, translatedContent } = parseTranslation(translated, fm);

      // Write translated MDX
      const mdx = `---
title: "${translatedTitle.replace(/"/g, '\\"')}"
date: "${fm.date}"
slug: "${fm.slug}"
tags: [${fm.tags}]
source: "${fm.source}"
originalTitle: "${fm.title.replace(/"/g, '\\"')}"
---

${translatedContent}
`;

      writeFileSync(join(TARGET_DIR, file), mdx, "utf-8");
      success++;
      console.log("done");
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
