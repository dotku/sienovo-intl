#!/usr/bin/env node

/**
 * Pick the next approved, rewritten, unpublished article and send it to Buffer.
 *
 * Inputs:
 *   data/approved.txt       — list of approved article IDs (manual curation)
 *   data/posts/{id}.json    — rewritten LinkedIn post per article
 *   data/published.jsonl    — already-published history
 *
 * Usage:
 *   node scripts/publish-next.mjs              # queue to Buffer (for next queue slot)
 *   node scripts/publish-next.mjs --now        # publish immediately
 *   node scripts/publish-next.mjs --dry-run    # show what would be published
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const APPROVED = join(PROJECT_ROOT, "data/approved.txt");
const POSTS_DIR = join(PROJECT_ROOT, "data/posts");
const PUBLISHED = join(PROJECT_ROOT, "data/published.jsonl");

const TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const CHANNEL_ID = process.env.BUFFER_CHANNEL_ID;
const ORG_ID = "69c4dbfa2018374f0e982511"; // JY Tech LLC

if (!TOKEN || !CHANNEL_ID) {
  console.error("Missing BUFFER_ACCESS_TOKEN or BUFFER_CHANNEL_ID in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const NOW = args.includes("--now");
const DRY_RUN = args.includes("--dry-run");

// ── Load state ──────────────────────────────────────────────────────────────
function loadApproved() {
  if (!existsSync(APPROVED)) return [];
  return readFileSync(APPROVED, "utf-8")
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);
}

function loadPublishedIds() {
  if (!existsSync(PUBLISHED)) return new Set();
  const ids = new Set();
  for (const line of readFileSync(PUBLISHED, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.article_id) ids.add(rec.article_id);
    } catch {}
  }
  return ids;
}

// ── Pick next ───────────────────────────────────────────────────────────────
function pickNext() {
  const approved = loadApproved();
  const published = loadPublishedIds();

  for (const id of approved) {
    if (published.has(id)) continue;
    const postPath = join(POSTS_DIR, `${id}.json`);
    if (!existsSync(postPath)) {
      console.log(`  (skip ${id}: no rewritten post at ${postPath})`);
      continue;
    }
    return { id, postPath };
  }
  return null;
}

// ── GraphQL helpers ─────────────────────────────────────────────────────────
async function gql(query, variables = {}) {
  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  if (data.errors) throw new Error(`GraphQL: ${JSON.stringify(data.errors)}`);
  return data.data;
}

async function createBufferPost(text, mode) {
  const data = await gql(
    `mutation($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess { post { id text } }
        ... on MutationError { message }
      }
    }`,
    {
      input: {
        text,
        channelId: CHANNEL_ID,
        schedulingType: "automatic",
        mode,
      },
    }
  );
  return data.createPost;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const next = pickNext();
  if (!next) {
    console.log("No unpublished approved article with a rewritten post.");
    console.log("  • Add IDs to data/approved.txt");
    console.log("  • Run rewrite-for-linkedin.mjs --approved");
    console.log("  • Rerun this command");
    process.exit(0);
  }

  const post = JSON.parse(readFileSync(next.postPath, "utf-8"));
  const mode = NOW ? "shareNow" : "addToQueue";

  console.log("─".repeat(60));
  console.log(`Next article:  ${next.id}`);
  console.log(`Title:         ${post.title_en?.slice(0, 60) || "?"}`);
  console.log(`Chars:         ${post.text.length}`);
  console.log(`Link:          ${post.link || "(none)"}`);
  console.log(`Image:         ${post.image ? "yes" : "no"}`);
  console.log(`Mode:          ${mode}`);
  console.log("─".repeat(60));
  console.log("");
  console.log(post.text);
  console.log("");
  console.log("─".repeat(60));

  if (DRY_RUN) {
    console.log("[dry-run] Not sending.");
    return;
  }

  const result = await createBufferPost(post.text, mode);

  if (result.__typename !== "PostActionSuccess") {
    console.error(`❌ ${result.__typename}: ${result.message || "?"}`);
    process.exit(1);
  }

  const record = {
    article_id: next.id,
    buffer_post_id: result.post.id,
    published_at: new Date().toISOString(),
    channel: "linkedin",
    channel_id: CHANNEL_ID,
    title: post.title_en,
    mode,
  };
  appendFileSync(PUBLISHED, JSON.stringify(record) + "\n", "utf-8");

  console.log(`✅ Sent to Buffer (mode=${mode}, post_id=${result.post.id})`);
  console.log(`   Recorded to data/published.jsonl`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
