#!/usr/bin/env node

/**
 * Sync blog articles from content/blog/*.mdx into KnowledgeArticle table.
 * Translates Chinese articles to English using Z.AI (free) → DeepSeek fallback.
 * Skips articles that already exist in the database.
 *
 * Articles are inserted with indexStatus: "pending" — run RAG indexing
 * separately from the admin "Articles" page or via /api/admin/knowledge/index-all.
 *
 * Usage:
 *   node scripts/sync-blog-to-db.mjs              # sync all untranslated
 *   node scripts/sync-blog-to-db.mjs --limit 50   # sync up to 50 articles
 *   node scripts/sync-blog-to-db.mjs --no-translate  # save zh only, skip translation
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import matter from "gray-matter";
import pg from "pg";

// ── Load env ────────────────────────────────────────────────────────────────
const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const BLOG_DIR = join(PROJECT_ROOT, "content/blog");
const ZAI_KEY = process.env.ZAI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const TRANSLATE = !args.includes("--no-translate");
const DELAY_MS = 500;

// ── Translation provider chain ──────────────────────────────────────────────
const PROVIDERS = [
  ZAI_KEY && {
    name: "zai",
    url: "https://api.z.ai/api/paas/v4/chat/completions",
    key: ZAI_KEY,
    model: "GLM-4.7-Flash",
    maxTokensKey: "max_tokens",
  },
  DEEPSEEK_KEY && {
    name: "deepseek",
    url: "https://api.deepseek.com/chat/completions",
    key: DEEPSEEK_KEY,
    model: "deepseek-chat",
    maxTokensKey: "max_tokens",
  },
  CEREBRAS_KEY && {
    name: "cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    key: CEREBRAS_KEY,
    model: "qwen-3-235b-a22b-instruct-2507",
    maxTokensKey: "max_completion_tokens",
  },
].filter(Boolean);

if (TRANSLATE && PROVIDERS.length === 0) {
  console.error("No translation provider configured. Set ZAI_API_KEY, DEEPSEEK_API_KEY, or CEREBRAS_API_KEY.");
  process.exit(1);
}

async function translate(title, content) {
  const prompt = `Translate this Chinese technical blog post to English. Keep code blocks, URLs, and technical terms unchanged. Return ONLY the translated text starting with the title on the first line, nothing else.\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 12000)}`;

  for (const p of PROVIDERS) {
    try {
      const body = {
        model: p.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      };
      body[p.maxTokensKey] = 8192;

      const res = await fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`  [${p.name}] HTTP ${res.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const translated = data.choices?.[0]?.message?.content || "";
      if (!translated) continue;

      const lines = translated.split("\n").filter((l) => l.trim());
      const translatedTitle = lines[0]?.replace(/^#+\s*/, "").replace(/^Title:\s*/i, "") || title;
      // Remove the title line from content
      const translatedContent = lines.slice(1).join("\n").trim() || translated;
      return { title: translatedTitle, content: translatedContent, provider: p.name };
    } catch (err) {
      console.warn(`  [${p.name}] error:`, err.message);
      continue;
    }
  }
  return null;
}

// ── Database ────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: DATABASE_URL.replace("sslmode=require", "sslmode=verify-full"),
});

async function articleExists(category) {
  const res = await pool.query(
    `SELECT id FROM "KnowledgeArticle" WHERE category = $1 LIMIT 1`,
    [category]
  );
  return res.rows.length > 0;
}

function generateCuid() {
  // Simple cuid-compatible ID
  return "c" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function insertArticle(title, content, category) {
  const id = generateCuid();
  await pool.query(
    `INSERT INTO "KnowledgeArticle" (id, title, content, category, "indexStatus", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())`,
    [id, title, content, category]
  );
  return id;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Reading blog files...");
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  console.log(`Found ${files.length} blog files.\n`);

  let created = 0;
  let translated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const file of files) {
    if (processed >= LIMIT) break;

    const slug = file.replace(/\.mdx$/, "");
    const zhCategory = `blog-zh-${slug}`;
    const enCategory = `blog-en-${slug}`;

    const zhExists = await articleExists(zhCategory);
    const enExists = await articleExists(enCategory);

    if (zhExists && (!TRANSLATE || enExists)) {
      skipped++;
      continue;
    }

    processed++;
    const filepath = join(BLOG_DIR, file);
    const raw = readFileSync(filepath, "utf8");
    const { data: frontmatter, content } = matter(raw);
    const title = frontmatter.title || slug;

    console.log(`[${processed}] ${title}`);

    // Insert Chinese version
    if (!zhExists) {
      try {
        await insertArticle(title, content, zhCategory);
        created++;
        console.log(`  ✓ ZH inserted`);
      } catch (err) {
        console.error(`  ✗ ZH failed:`, err.message);
        failed++;
        continue;
      }
    }

    // Translate and insert English version
    if (TRANSLATE && !enExists) {
      const result = await translate(title, content);
      if (result) {
        try {
          await insertArticle(result.title, result.content, enCategory);
          translated++;
          console.log(`  ✓ EN translated via ${result.provider}`);
        } catch (err) {
          console.error(`  ✗ EN insert failed:`, err.message);
          failed++;
        }
      } else {
        console.warn(`  ✗ Translation failed (all providers exhausted)`);
        failed++;
      }

      // Rate limiting between translations
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Processed: ${processed}`);
  console.log(`ZH created: ${created}`);
  console.log(`EN translated: ${translated}`);
  console.log(`Skipped (already in DB): ${skipped}`);
  console.log(`Failed: ${failed}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  pool.end();
  process.exit(1);
});
