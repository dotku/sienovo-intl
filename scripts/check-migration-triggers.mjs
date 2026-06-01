#!/usr/bin/env node
/**
 * Monthly check: should jytech data pool migrate from Neon → AWS RDS yet?
 *
 * Hosted in sienovo-intl because (a) sienovo-intl is public so GitHub
 * Actions minutes are unlimited / free, (b) sienovo-intl is the most
 * active repo so the 60-day-inactivity cron-pause never triggers, and
 * (c) the AWS / Resend secrets we need are already there.
 *
 * Evaluates three conditions, prints a markdown report to stdout, and
 * exits 0. The workflow takes the markdown and (a) writes it to
 * $GITHUB_STEP_SUMMARY for GitHub UI, (b) sends it as an HTML email
 * via Resend to dev@jytech.us.
 *
 * Conditions:
 *   1. jytech-data-pool DB > 100 GB                  (Neon API)
 *   2. Bedrock invocations > 10k/day or cost > $50/mo (CloudWatch)
 *   3. sienovo-intl + autoclaw-web both integrated   (grep both repos)
 *
 * All three met → recommend immediate Neon → RDS r7g.large + 1yr RI.
 * Any not met → "Stay on Neon another month, recheck on the 1st."
 *
 * Env:
 *   GH_TOKEN              required — for jytech-data-pool repo lookup
 *   AUTOCLAW_WEB_DIR      required — path to a cloned jytechllc/autoclaw-web
 *   BEDROCK_INVOCATIONS   optional — pre-fetched 30d invocation total
 *   BEDROCK_INPUT_TOKENS  optional — pre-fetched 30d input token total
 *   BEDROCK_OUTPUT_TOKENS optional — pre-fetched 30d output token total
 *   NEON_API_KEY          optional — for live DB size check
 *   NEON_PROJECT_ID       optional — paired with NEON_API_KEY
 *   NEON_DATABASE_NAME    optional — defaults to "neondb"
 *
 * Output: GitHub-flavored markdown on stdout.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const POOL_REPO = "jytechllc/jytech-data-pool";
const POOL_REPO_LEGACY = "jytechllc/autoclaw-data-scraper";
const SIENOVO_LEADS_PATH = "scripts/outreach-pull-leads.mjs";
const STORAGE_THRESHOLD_GB = 100;
const INVOCATIONS_THRESHOLD_PER_DAY = 10_000;
const COST_THRESHOLD_USD = 50;
// Anthropic Sonnet 4.5 pricing on Bedrock (per 1M tokens).
const SONNET_IN_USD_PER_M = 3;
const SONNET_OUT_USD_PER_M = 15;

const today = new Date().toISOString().slice(0, 10);

// ---------- helpers ----------

async function ghRepo(slug) {
  if (!process.env.GH_TOKEN) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${slug}`, {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (r.status === 404) return { exists: false };
    if (!r.ok) return null;
    const d = await r.json();
    return { exists: true, createdAt: d.created_at, pushedAt: d.pushed_at, private: d.private };
  } catch {
    return null;
  }
}

async function neonDbSizeGB() {
  const key = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!key || !projectId) return null;
  const dbName = process.env.NEON_DATABASE_NAME || "neondb";
  try {
    const r = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}/databases/${dbName}/sizes`,
      { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    // Neon returns size in bytes — convert to GB (decimal).
    const bytes = d?.size_bytes ?? d?.data_size_bytes ?? null;
    if (typeof bytes !== "number") return null;
    return bytes / 1e9;
  } catch {
    return null;
  }
}

function fileContains(path, ...patterns) {
  if (!existsSync(path)) return { exists: false };
  const body = readFileSync(path, "utf8");
  const matched = patterns.filter((p) => body.includes(p));
  return { exists: true, matched };
}

function grepRecursive(rootDir, ...patterns) {
  if (!existsSync(rootDir)) return [];
  const hits = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch { continue; }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist" || e.name === ".next") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (/\.(ts|tsx|js|jsx|mjs|json)$/.test(e.name)) {
        let body;
        try { body = readFileSync(full, "utf8"); } catch { continue; }
        for (const p of patterns) {
          if (body.includes(p)) {
            hits.push({ file: full.replace(`${rootDir}/`, ""), pattern: p });
            break;
          }
        }
      }
    }
  }
  return hits;
}

function fmt(n, suffix = "") {
  if (n == null) return "—";
  if (typeof n === "number" && !Number.isInteger(n)) return n.toFixed(2) + suffix;
  return n.toLocaleString() + suffix;
}

// ---------- conditions ----------

async function check1Storage() {
  // First: does the project even exist as a repo?
  const newRepo = await ghRepo(POOL_REPO);
  const legacyRepo = await ghRepo(POOL_REPO_LEGACY);

  const repoFound = newRepo?.exists ? POOL_REPO : (legacyRepo?.exists ? POOL_REPO_LEGACY : null);
  if (!repoFound) {
    return {
      label: "Data pool DB > 100 GB",
      status: "pending",
      detail: `Project not yet started — neither \`${POOL_REPO}\` nor \`${POOL_REPO_LEGACY}\` was found.`,
    };
  }

  // Try Neon API if creds are present.
  const sizeGB = await neonDbSizeGB();
  if (sizeGB == null) {
    return {
      label: "Data pool DB > 100 GB",
      status: "unknown",
      detail:
        `Found \`${repoFound}\` but no NEON_API_KEY / NEON_PROJECT_ID secret set. ` +
        `Add these to dotku/sienovo-intl secrets to enable automated size checks. ` +
        `Manual probe: \`curl -sH "Authorization: Bearer $NEON_API_KEY" ` +
        `https://console.neon.tech/api/v2/projects/<id>/databases/<db>/sizes | jq .\``,
    };
  }

  const met = sizeGB > STORAGE_THRESHOLD_GB;
  return {
    label: "Data pool DB > 100 GB",
    status: met ? "met" : "not-met",
    detail: `Current size: **${fmt(sizeGB)} GB** (threshold ${STORAGE_THRESHOLD_GB} GB).`,
  };
}

function check2Bedrock() {
  const invocations = process.env.BEDROCK_INVOCATIONS
    ? Number(process.env.BEDROCK_INVOCATIONS) : null;
  const inputTokens = process.env.BEDROCK_INPUT_TOKENS
    ? Number(process.env.BEDROCK_INPUT_TOKENS) : null;
  const outputTokens = process.env.BEDROCK_OUTPUT_TOKENS
    ? Number(process.env.BEDROCK_OUTPUT_TOKENS) : null;

  if (invocations == null) {
    return {
      label: "Bedrock production-scale usage",
      status: "unknown",
      detail:
        `No BEDROCK_INVOCATIONS reading from workflow. ` +
        `Check the "fetch Bedrock metrics" step output for the CloudWatch error.`,
    };
  }

  const dailyAvg = invocations / 30;
  const costInput = inputTokens != null ? (inputTokens / 1e6) * SONNET_IN_USD_PER_M : null;
  const costOutput = outputTokens != null ? (outputTokens / 1e6) * SONNET_OUT_USD_PER_M : null;
  const costMonth = (costInput ?? 0) + (costOutput ?? 0);

  const metByInvocations = dailyAvg > INVOCATIONS_THRESHOLD_PER_DAY;
  const metByCost = costMonth > COST_THRESHOLD_USD;
  const met = metByInvocations || metByCost;

  return {
    label: "Bedrock production-scale usage",
    status: met ? "met" : "not-met",
    detail:
      `30d invocations: **${fmt(invocations)}** (avg **${fmt(dailyAvg)}**/day, ` +
      `threshold ${fmt(INVOCATIONS_THRESHOLD_PER_DAY)}/day). ` +
      (inputTokens != null && outputTokens != null
        ? `Cost ≈ **$${fmt(costMonth)}** (in $${fmt(costInput)} + out $${fmt(costOutput)}, ` +
          `threshold $${COST_THRESHOLD_USD}/month).`
        : `Token-cost calc unavailable (BEDROCK_INPUT_TOKENS / BEDROCK_OUTPUT_TOKENS missing).`),
  };
}

function check3Integration() {
  // sienovo-intl is the repo this workflow lives in — process.cwd() should
  // be its root after actions/checkout. The leads script must NOT still
  // reference apollo's host.
  const leadsScript = fileContains(
    SIENOVO_LEADS_PATH,
    "apollo.io",
    "api.apollo.io",
    "Apollo API",
  );
  const sienovoStillApollo = leadsScript.exists && leadsScript.matched.length > 0;

  // autoclaw-web — cloned separately into AUTOCLAW_WEB_DIR by the workflow.
  const autoclawDir = process.env.AUTOCLAW_WEB_DIR;
  let autoclawHits = [];
  if (autoclawDir && existsSync(autoclawDir)) {
    autoclawHits = grepRecursive(
      join(autoclawDir, "app"),
      "data-pool",
      "jytech-data-pool",
      "jytechdata",
    );
    if (autoclawHits.length === 0) {
      autoclawHits = grepRecursive(
        join(autoclawDir, "lib"),
        "data-pool",
        "jytech-data-pool",
        "jytechdata",
      );
    }
  }

  const sienovoIntegrated = !sienovoStillApollo;
  const autoclawIntegrated = autoclawHits.length > 0;
  const both = sienovoIntegrated && autoclawIntegrated;

  const lines = [];
  lines.push(
    `- sienovo-intl: ${sienovoIntegrated ? "✅ no direct Apollo calls" : "❌ still calls Apollo in `" + SIENOVO_LEADS_PATH + "`"}`,
  );
  if (!autoclawDir) {
    lines.push(`- autoclaw-web: ⚠ AUTOCLAW_WEB_DIR not set (workflow did not clone it)`);
  } else if (!existsSync(autoclawDir)) {
    lines.push(`- autoclaw-web: ⚠ Path \`${autoclawDir}\` doesn't exist`);
  } else {
    lines.push(
      `- autoclaw-web: ${autoclawIntegrated ? `✅ ${autoclawHits.length} data-pool reference(s)` : "❌ no data-pool references"}`,
    );
  }

  return {
    label: "sienovo-intl + autoclaw-web both integrated with data pool",
    status: both ? "met" : "not-met",
    detail: lines.join("\n"),
  };
}

// ---------- main ----------

const c1 = await check1Storage();
const c2 = check2Bedrock();
const c3 = check3Integration();

const allChecks = [c1, c2, c3];
const allMet = allChecks.every((c) => c.status === "met");
const numMet = allChecks.filter((c) => c.status === "met").length;

const statusBadge = (s) =>
  ({ met: "✅ Met", "not-met": "❌ Not met", pending: "⏳ Pending", unknown: "❓ Unknown" })[s] || s;

const lines = [];
lines.push(`# jytech data-pool migration trigger check — ${today}`);
lines.push("");
lines.push(`**Conditions met: ${numMet} / ${allChecks.length}**`);
lines.push("");

for (const c of allChecks) {
  lines.push(`## ${statusBadge(c.status)} · ${c.label}`);
  lines.push("");
  lines.push(c.detail);
  lines.push("");
}

lines.push("## Recommendation");
lines.push("");
if (allMet) {
  lines.push(
    "**🚀 Migrate now.** All three triggers fired — start the Neon → AWS RDS cutover.",
  );
  lines.push("");
  lines.push("**Target SKU**: AWS RDS Postgres `db.r7g.large` + 1 TB `gp3` storage + 1-year Reserved Instance.");
  lines.push("");
  lines.push("**Estimated cost**: ~$200–300/month (vs Neon at similar scale ~$400–600/month).");
  lines.push("");
  lines.push("**Hidden win**: same-region as Bedrock → $0 egress on every LLM call.");
  lines.push("");
  lines.push("**Migration sketch**:");
  lines.push("1. `pg_dump` the Neon DB to S3.");
  lines.push("2. Provision RDS via OpenTofu (`sienovo-intl/infra/`).");
  lines.push("3. `pg_restore` into RDS.");
  lines.push("4. Cut consumers' `DATABASE_URL` to the new RDS endpoint behind a feature flag.");
  lines.push("5. Drain Neon connections, snapshot it for the record, then retire.");
} else {
  lines.push("**🟢 Stay on Neon another month.** Recheck on the 1st of next month.");
  const laggards = allChecks
    .filter((c) => c.status !== "met")
    .map((c) => `- ${statusBadge(c.status)} ${c.label}`);
  if (laggards.length) {
    lines.push("");
    lines.push("Still waiting on:");
    lines.push(...laggards);
  }
}

lines.push("");
lines.push("---");
lines.push(`<sub>Generated by \`scripts/check-migration-triggers.mjs\` in dotku/sienovo-intl. ` +
           `Hosted here because sienovo-intl is public (unlimited free Actions minutes) and stays active.</sub>`);

console.log(lines.join("\n"));
