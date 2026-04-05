#!/usr/bin/env node

/**
 * Batch fetch all CSDN blog articles and convert to MDX.
 * Images are uploaded to Cloudflare R2.
 *
 * Usage:
 *   node scripts/fetch-csdn.mjs                    # fetch all
 *   node scripts/fetch-csdn.mjs --resume            # skip already fetched
 *   node scripts/fetch-csdn.mjs --limit 10          # fetch first 10 only
 *   node scripts/fetch-csdn.mjs --start 100         # start from article #100
 */

import { chromium } from "playwright";
import TurndownService from "turndown";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join, basename } from "path";
import { config } from "dotenv";
import https from "https";
import http from "http";

// ── Load .env.local ─────────────────────────────────────────────────────────
const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

// ── Config ──────────────────────────────────────────────────────────────────
const CONTENT_DIR = join(PROJECT_ROOT, "content/blog");
const ARTICLE_LIST = "/tmp/csdn_final_articles.txt";
const DELAY_MS = 2000;
const PAGE_TIMEOUT = 25000;
const BATCH_SIZE = 20;

// ── R2 Config ───────────────────────────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

if (
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME ||
  !R2_PUBLIC_URL
) {
  console.error(
    "Missing R2 env vars. Need: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL"
  );
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const RESUME = args.includes("--resume");
const LIMIT = args.includes("--limit")
  ? parseInt(args[args.indexOf("--limit") + 1], 10)
  : Infinity;
const START = args.includes("--start")
  ? parseInt(args[args.indexOf("--start") + 1], 10)
  : 1;

// ── Parse article list ──────────────────────────────────────────────────────
function parseArticleList(filepath) {
  const text = readFileSync(filepath, "utf-8");
  const articles = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const urlMatch = lines[i].match(
      /https:\/\/blog\.csdn\.net\/\w+\/article\/details\/(\d+)/
    );
    if (urlMatch) {
      const titleLine = lines[i - 1] || "";
      const title = titleLine.replace(/^\s*\d+\.\s*/, "").trim();
      articles.push({ id: urlMatch[1], url: urlMatch[0], title });
    }
  }
  return articles;
}

// ── Download image to buffer ────────────────────────────────────────────────
function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), 15000);
    const client = url.startsWith("https") ? https : http;
    client
      .get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://blog.csdn.net/",
          },
        },
        (res) => {
          clearTimeout(timeout);
          if (res.statusCode === 301 || res.statusCode === 302) {
            return downloadImageBuffer(res.headers.location)
              .then(resolve)
              .catch(reject);
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            resolve({
              buffer: Buffer.concat(chunks),
              contentType: res.headers["content-type"] || "image/png",
            });
          });
          res.on("error", reject);
        }
      )
      .on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
  });
}

// ── Upload to R2 ────────────────────────────────────────────────────────────
async function uploadToR2(key, buffer, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

// ── Setup Turndown ──────────────────────────────────────────────────────────
function createTurndown(imageMap) {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  td.addRule("csdnImages", {
    filter: "img",
    replacement: (_content, node) => {
      const src =
        node.getAttribute("src") || node.getAttribute("data-src") || "";
      const alt = node.getAttribute("alt") || "";
      if (!src || src.startsWith("data:")) return "";
      const r2Url = imageMap.get(src);
      return r2Url ? `![${alt}](${r2Url})` : `![${alt}](${src})`;
    },
  });

  td.addRule("cleanEmptyLinks", {
    filter: (node) => node.nodeName === "A" && !node.textContent.trim(),
    replacement: () => "",
  });

  td.addRule("csdnCodeBlocks", {
    filter: (node) => node.nodeName === "PRE" && node.querySelector("code"),
    replacement: (_content, node) => {
      const code = node.querySelector("code");
      const lang =
        (code?.className || "").replace(/^language-/, "").split(" ")[0] || "";
      const text = code?.textContent || "";
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    },
  });

  return td;
}

// ── Launch browser ──────────────────────────────────────────────────────────
async function launchBrowser() {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  return { browser, page };
}

// ── Fetch single article ────────────────────────────────────────────────────
async function fetchArticle(page, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: PAGE_TIMEOUT });
  await page
    .waitForSelector("#content_views, .article_content", { timeout: 10000 })
    .catch(() => {});

  return page.evaluate(() => {
    const title =
      document.querySelector("h1.title-article, .article-title-box h1")
        ?.textContent?.trim() || "";
    const dateText =
      document.querySelector(
        ".time, .article-bar-top .time, span[class*='time']"
      )?.textContent?.trim() || "";
    const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "";

    const contentEl = document.querySelector(
      "#content_views, .article_content"
    );
    if (contentEl) {
      contentEl
        .querySelectorAll(
          ".hide-article-box, .more-toolbox, script, style, .recommend-box, .csdn-side-toolbar"
        )
        .forEach((el) => el.remove());
    }
    const contentHtml = contentEl?.innerHTML || "";

    const images = [
      ...document.querySelectorAll("#content_views img, .article_content img"),
    ]
      .map((img) => {
        const src = img.getAttribute("src") || "";
        const dataSrc = img.getAttribute("data-src") || "";
        const imgUrl = src && !src.startsWith("data:") ? src : dataSrc;
        return { url: imgUrl, alt: img.alt || "" };
      })
      .filter((img) => img.url && !img.url.startsWith("data:"));

    const tags = [...document.querySelectorAll(".tag-link, .artic-tag-box a")]
      .map((a) => a.textContent?.trim())
      .filter(Boolean);

    return { title, date, contentHtml, images, tags };
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(CONTENT_DIR, { recursive: true });

  const allArticles = parseArticleList(ARTICLE_LIST);
  console.log(`Found ${allArticles.length} articles in list`);
  console.log(`R2 bucket: ${R2_BUCKET_NAME} → ${R2_PUBLIC_URL}`);

  const articles = allArticles.slice(START - 1, START - 1 + LIMIT);
  console.log(
    `Processing articles ${START} to ${START + articles.length - 1} (${articles.length} total)`
  );

  const existing = new Set(
    existsSync(CONTENT_DIR)
      ? readdirSync(CONTENT_DIR)
          .filter((f) => f.endsWith(".mdx"))
          .map((f) => f.replace(/\.mdx$/, ""))
      : []
  );
  if (RESUME) {
    console.log(`Resume mode: ${existing.size} articles already fetched`);
  }

  let { browser, page } = await launchBrowser();
  let fetched = 0;
  let skipped = 0;
  let failed = 0;
  let totalImages = 0;

  for (let i = 0; i < articles.length; i++) {
    const { id, url, title } = articles[i];
    const num = START + i;

    if (RESUME && existing.has(id)) {
      skipped++;
      continue;
    }

    // Restart browser periodically
    if (fetched > 0 && fetched % BATCH_SIZE === 0) {
      console.log(`  [Restarting browser after ${fetched} articles...]`);
      await browser.close();
      ({ browser, page } = await launchBrowser());
    }

    try {
      process.stdout.write(
        `[${num}/${allArticles.length}] ${title.substring(0, 55).padEnd(55)} `
      );

      const data = await fetchArticle(page, url);

      if (!data.title && !data.contentHtml) {
        console.log("⚠ empty/404");
        failed++;
        continue;
      }

      // Download images and upload to R2
      const imageMap = new Map();
      let uploaded = 0;

      for (let j = 0; j < data.images.length; j++) {
        const img = data.images[j];
        try {
          const urlObj = new URL(img.url);
          let filename = basename(urlObj.pathname);
          if (!/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(filename)) {
            filename += ".png";
          }
          filename = `${String(j + 1).padStart(2, "0")}_${filename}`;

          const { buffer, contentType } = await downloadImageBuffer(img.url);
          const r2Key = `blog/${id}/${filename}`;
          const publicUrl = await uploadToR2(r2Key, buffer, contentType);
          imageMap.set(img.url, publicUrl);
          uploaded++;
        } catch {
          // Failed to download/upload, keep original URL
        }
      }

      // Convert to markdown
      const td = createTurndown(imageMap);
      const markdown = td.turndown(data.contentHtml);

      // Write MDX
      const useTitle = data.title || title;
      const mdx = `---
title: "${useTitle.replace(/"/g, '\\"')}"
date: "${data.date}"
slug: "${id}"
tags: [${data.tags.map((t) => `"${t}"`).join(", ")}]
source: "${url}"
---

${markdown}
`;
      writeFileSync(join(CONTENT_DIR, `${id}.mdx`), mdx, "utf-8");

      fetched++;
      totalImages += uploaded;
      console.log(
        `✓ ${data.images.length} imgs, ${uploaded} → R2`
      );
    } catch (err) {
      failed++;
      console.log(`✗ ${err.message.substring(0, 50)}`);

      if (
        err.message.includes("closed") ||
        err.message.includes("crashed") ||
        err.message.includes("Target")
      ) {
        console.log("  [Browser crashed, restarting...]");
        try {
          await browser.close();
        } catch {}
        ({ browser, page } = await launchBrowser());
      }
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  await browser.close();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done!`);
  console.log(`  Fetched:  ${fetched}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Images:   ${totalImages} uploaded to R2`);
  console.log(`  MDX dir:  ${CONTENT_DIR}`);
  console.log(`  R2 base:  ${R2_PUBLIC_URL}/blog/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
