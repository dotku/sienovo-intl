#!/usr/bin/env node

/**
 * Print a ready-to-post LinkedIn entry for copy-paste into Buffer / LinkedIn UI.
 *
 * Usage:
 *   node scripts/show-post.mjs                        # first unposted approved article
 *   node scripts/show-post.mjs --id 134104142          # specific article
 *   node scripts/show-post.mjs --post data/test-post.json  # from a prepared JSON
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });
const args = process.argv.slice(2);

const POST_FILE = args.includes("--post") ? args[args.indexOf("--post") + 1] : null;
const ID = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;

function printPost(post) {
  console.log("═".repeat(72));
  console.log(" COPY → BUFFER");
  console.log("═".repeat(72));
  console.log("");
  console.log("── TEXT (" + post.text.length + " chars) " + "─".repeat(40));
  console.log("");
  console.log(post.text);
  console.log("");
  console.log("── LINK ".padEnd(72, "─"));
  console.log(post.link || "(no link)");
  console.log("");
  console.log("── IMAGE ".padEnd(72, "─"));
  console.log(post.image || "(no image)");
  console.log("");
  console.log("═".repeat(72));
  console.log(" Paste text into Buffer, add link + image, schedule/publish.");
  console.log("═".repeat(72));
}

if (POST_FILE) {
  let raw = readFileSync(POST_FILE, "utf-8");
  raw = raw.replace(/[A-Z_][A-Z0-9_]{3,}/g, (token) =>
    process.env[token] !== undefined ? process.env[token] : token
  );
  const post = JSON.parse(raw);
  printPost(post);
} else {
  console.error("Not implemented yet: --id / auto-next. Use --post <file.json> for now.");
  process.exit(1);
}
