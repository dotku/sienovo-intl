#!/usr/bin/env node

/**
 * Scrape the CSDN blog article list and update scripts/article-list.txt.
 * Only adds new articles not already in the list.
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const LIST_FILE = join(PROJECT_ROOT, "scripts/article-list.txt");
const CSDN_CHANNELS = [
  { username: "yeyuangen", name: "YEYUANGEN" },
  { username: "ARM_FPGA_AI", name: "ARM_FPGA_AI" },
  { username: "szxinmai", name: "szxinmai" },
];

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

// Parse existing IDs from the list
function getExistingIds() {
  if (!existsSync(LIST_FILE)) return new Set();
  const text = readFileSync(LIST_FILE, "utf-8");
  const ids = new Set();
  for (const match of text.matchAll(/\/article\/details\/(\d+)/g)) {
    ids.add(match[1]);
  }
  return ids;
}

async function scrapeChannel(page, channel, existingIds) {
  const baseUrl = `https://blog.csdn.net/${channel.username}/article/list`;
  const newArticles = [];
  let pageNum = 1;
  let foundExisting = false;

  console.log(`\n=== Scraping channel: ${channel.name} (${channel.username}) ===`);

  while (!foundExisting && pageNum <= 50) {
    try {
      const url = `${baseUrl}/${pageNum}`;
      console.log(`  Page ${pageNum}...`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await page
        .waitForSelector(".article-list, .article-item-box", { timeout: 10000 })
        .catch(() => {});

      const articles = await page.evaluate(() => {
        const items = document.querySelectorAll(
          ".article-item-box, article.blog-list-box"
        );
        return [...items].map((item) => {
          const link = item.querySelector("a[href*='/article/details/']");
          const title =
            link?.textContent?.trim() ||
            item.querySelector("h4, .article-title")?.textContent?.trim() ||
            "";
          const href = link?.getAttribute("href") || "";
          const idMatch = href.match(/\/details\/(\d+)/);
          return {
            id: idMatch ? idMatch[1] : "",
            url: href.startsWith("http")
              ? href
              : `https://blog.csdn.net${href}`,
            title: title.replace(/\n/g, " ").replace(/\s+/g, " ").trim(),
          };
        }).filter((a) => a.id);
      });

      if (articles.length === 0) {
        console.log(`    No articles found, stopping.`);
        break;
      }

      for (const article of articles) {
        if (existingIds.has(article.id)) {
          foundExisting = true;
          break;
        }
        newArticles.push({ ...article, source: channel.username });
        existingIds.add(article.id);
      }

      console.log(`    Found ${articles.length}, ${newArticles.length} new from this channel`);
      pageNum++;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.log(`    Error: ${err.message.substring(0, 50)}`);
      break;
    }
  }

  return newArticles;
}

async function main() {
  const existingIds = getExistingIds();
  console.log(`Existing articles in list: ${existingIds.size}`);

  const { browser, page } = await launchBrowser();
  const newArticles = [];

  for (const channel of CSDN_CHANNELS) {
    const channelArticles = await scrapeChannel(page, channel, existingIds);
    newArticles.push(...channelArticles);
  }

  await browser.close();

  if (newArticles.length === 0) {
    console.log("No new articles found.");
    return;
  }

  // Read existing file and prepend new articles
  const existingContent = existsSync(LIST_FILE)
    ? readFileSync(LIST_FILE, "utf-8")
    : "";

  // Parse existing count
  const countMatch = existingContent.match(
    /Total unique articles found: (\d+)/
  );
  const oldCount = countMatch ? parseInt(countMatch[1], 10) : 0;
  const newCount = oldCount + newArticles.length;

  // Build new entries (include source channel)
  const newEntries = newArticles
    .map(
      (a, i) =>
        `   ${i + 1}. [${a.source}] ${a.title}\n      ${a.url}`
    )
    .join("\n");

  // Update header and prepend
  let updated = existingContent.replace(
    /Total unique articles found: \d+/,
    `Total unique articles found: ${newCount}`
  );

  // Find insertion point (after header lines)
  const insertAfter = updated.indexOf("\n\n") + 2;
  updated =
    updated.substring(0, insertAfter) +
    newEntries +
    "\n" +
    updated.substring(insertAfter);

  // Renumber all entries
  let num = 0;
  updated = updated.replace(/^\s+\d+\.\s/gm, () => {
    num++;
    return `   ${num}. `;
  });

  writeFileSync(LIST_FILE, updated, "utf-8");
  console.log(`\nAdded ${newArticles.length} new articles. Total: ${newCount}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
