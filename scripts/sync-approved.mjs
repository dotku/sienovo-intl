#!/usr/bin/env node

/**
 * Sync approvals from data/shortlist.csv into data/approved.txt.
 * Picks rows where decision column = "approve" (case-insensitive).
 * Appends new IDs only (never removes existing).
 *
 * Usage:
 *   node scripts/sync-approved.mjs            # append new approved IDs
 *   node scripts/sync-approved.mjs --dry-run  # preview without writing
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const CSV = join(PROJECT_ROOT, "data/shortlist.csv");
const APPROVED = join(PROJECT_ROOT, "data/approved.txt");

const DRY_RUN = process.argv.includes("--dry-run");

if (!existsSync(CSV)) {
  console.error(`Missing ${CSV}. Run score-articles.mjs first.`);
  process.exit(1);
}

// Parse CSV (simple: assumes our known format)
function parseCsv(raw) {
  const lines = raw.split("\n").filter(Boolean);
  const header = lines[0].split(",").map((s) => s.trim());
  const rows = [];
  for (const line of lines.slice(1)) {
    // Minimal CSV parser handling quoted fields with commas
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = !inQ;
      else if (c === "," && !inQ) { cols.push(cur); cur = ""; }
      else cur += c;
    }
    cols.push(cur);
    const row = {};
    header.forEach((h, i) => (row[h] = (cols[i] || "").trim()));
    rows.push(row);
  }
  return rows;
}

const rows = parseCsv(readFileSync(CSV, "utf-8"));
const approvedRows = rows.filter((r) => r.decision?.toLowerCase() === "approve");

// Read existing approved.txt
const existingLines = existsSync(APPROVED) ? readFileSync(APPROVED, "utf-8").split("\n") : [];
const existingIds = new Set(
  existingLines
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean)
);

const newRows = approvedRows.filter((r) => !existingIds.has(r.id));

console.log(`Shortlist: ${rows.length} rows, ${approvedRows.length} with decision=approve`);
console.log(`Existing in approved.txt: ${existingIds.size}`);
console.log(`New to add: ${newRows.length}`);

if (newRows.length === 0) {
  console.log("Nothing new.");
  process.exit(0);
}

const appendBlock =
  "\n# Added " + new Date().toISOString().split("T")[0] + " from shortlist.csv\n" +
  newRows.map((r) => `${r.id}  # score=${r.score} views=${r.views} — ${r.title.slice(0, 50)}`).join("\n") + "\n";

console.log("\nPreview of additions:\n");
console.log(appendBlock);

if (DRY_RUN) {
  console.log("[dry-run] not writing.");
  process.exit(0);
}

writeFileSync(APPROVED, (existsSync(APPROVED) ? readFileSync(APPROVED, "utf-8") : "") + appendBlock, "utf-8");
console.log(`✓ Wrote ${newRows.length} new IDs to ${APPROVED}`);
