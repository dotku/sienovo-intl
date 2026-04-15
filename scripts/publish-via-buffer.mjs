#!/usr/bin/env node

/**
 * Publish a LinkedIn post via Buffer's GraphQL API.
 * Endpoint: https://api.buffer.com
 * Token from: https://publish.buffer.com/settings/api
 *
 * Usage:
 *   node scripts/publish-via-buffer.mjs --list-channels                     # find channel IDs
 *   node scripts/publish-via-buffer.mjs --post data/test-post.json          # queue to Buffer
 *   node scripts/publish-via-buffer.mjs --post data/test-post.json --now    # publish immediately
 *
 * Env (.env.local):
 *   BUFFER_ACCESS_TOKEN=...   (from publish.buffer.com/settings/api)
 *   BUFFER_CHANNEL_ID=...     (LinkedIn JYTech channel id, set after --list-channels)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
config({ path: join(PROJECT_ROOT, ".env.local") });

const TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const CHANNEL_ID = process.env.BUFFER_CHANNEL_ID;

if (!TOKEN) {
  console.error("Missing BUFFER_ACCESS_TOKEN in .env.local");
  console.error("Get one from: https://publish.buffer.com/settings/api");
  process.exit(1);
}

const ENDPOINT = "https://api.buffer.com";

const args = process.argv.slice(2);
const LIST_CHANNELS = args.includes("--list-channels");
const POST_FILE = args.includes("--post") ? args[args.indexOf("--post") + 1] : null;
const NOW = args.includes("--now");

// ── GraphQL helper ──────────────────────────────────────────────────────────
async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text);
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors, null, 2)}`);
  }
  return data.data;
}

// ── List organizations and channels ─────────────────────────────────────────
async function listChannels() {
  console.log("Fetching organizations...");
  const orgData = await gql(`
    query {
      account {
        id
        email
        organizations { id name }
      }
    }
  `);
  const account = orgData.account;
  console.log(`Account: ${account.email} (${account.id})`);
  console.log(`Organizations: ${account.organizations.length}`);
  console.log("");

  for (const org of account.organizations) {
    console.log(`━━━ Organization: ${org.name} (id: ${org.id}) ━━━`);
    const channelData = await gql(
      `
      query($orgId: OrganizationId!) {
        channels(input: { organizationId: $orgId }) {
          id
          name
          displayName
          service
          avatar
          isQueuePaused
        }
      }
    `,
      { orgId: org.id }
    );
    const channels = channelData.channels || [];
    console.log(`Channels (${channels.length}):`);
    for (const c of channels) {
      console.log(`  [${c.service.padEnd(10)}] ${c.displayName || c.name}`);
      console.log(`    id:     ${c.id}`);
      console.log(`    paused: ${c.isQueuePaused ? "YES" : "no"}`);
      console.log("");
    }
  }

  console.log("👉 Copy the LinkedIn channel id and put it in .env.local as BUFFER_CHANNEL_ID");
}

// ── Create a post ───────────────────────────────────────────────────────────
async function createPost(postFile) {
  if (!CHANNEL_ID) {
    console.error("Missing BUFFER_CHANNEL_ID. Run --list-channels first.");
    process.exit(1);
  }

  let raw = readFileSync(postFile, "utf-8");

  // Substitute env placeholders: any ALL_CAPS token in the file that exists in env
  raw = raw.replace(/[A-Z_][A-Z0-9_]{3,}/g, (token) =>
    process.env[token] !== undefined ? process.env[token] : token
  );

  const post = JSON.parse(raw);
  if (!post.text) {
    console.error(`Post file ${postFile} must have a "text" field.`);
    process.exit(1);
  }

  let text = post.text;

  // Fail loudly if any placeholder remains
  const leftover = text.match(/\bREPLACE_\w+|\{\{[^}]+\}\}/g);
  if (leftover) {
    console.error(`❌ Unresolved placeholders in text: ${leftover.join(", ")}`);
    console.error(`   Add them to .env.local or edit ${postFile}`);
    process.exit(1);
  }

  const mode = NOW ? "shareNow" : "addToQueue";

  console.log("Creating post...");
  console.log(`  Channel:  ${CHANNEL_ID}`);
  console.log(`  Mode:     ${mode}`);
  console.log(`  Length:   ${text.length} chars`);
  console.log("");

  const data = await gql(
    `
    mutation($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess {
          post {
            id
            text
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `,
    {
      input: {
        text,
        channelId: CHANNEL_ID,
        schedulingType: "automatic",
        mode,
      },
    }
  );

  console.log("Response:");
  console.log(JSON.stringify(data, null, 2));

  const result = data.createPost;
  if (result.__typename === "PostActionSuccess") {
    console.log("");
    console.log(`✅ Post created! id: ${result.post.id}`);
    console.log(mode === "shareNow" ? "   Publishing immediately." : "   Added to Buffer queue — review at https://publish.buffer.com");
  } else {
    console.log("");
    console.log(`❌ ${result.__typename}: ${result.message || "(no message)"}`);
    process.exit(1);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
try {
  if (LIST_CHANNELS) {
    await listChannels();
  } else if (POST_FILE) {
    await createPost(POST_FILE);
  } else {
    console.log("Usage:");
    console.log("  --list-channels              List connected channels");
    console.log("  --post <file.json>           Queue to Buffer (review in UI)");
    console.log("  --post <file.json> --now     Publish immediately");
  }
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
