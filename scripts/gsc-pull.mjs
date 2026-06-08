// Pull current Search Console data + render concrete optimization to-dos.
// Run: GOOGLE_APPLICATION_CREDENTIALS=~/.gcp-keys/sienovo-intl-sa.json node scripts/gsc-pull.mjs
//
// Outputs:
//   data/seo-reports/YYYY-MM-DD.json   raw last-28-day metrics
//   data/seo-reports/YYYY-MM-DD.md     human-readable digest with action items

import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const SITE_URL = process.env.SITE_URL || "https://intl.sienovo.cn";
const OUT_DIR = path.join(process.cwd(), "data/seo-reports");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Prefer inline JSON — GA_SERVICE_ACCOUNT_KEY is the autoclaw-analytics service
// account that's actually granted access to the intl.sienovo.cn GSC property.
// The old sienovo-intl-sa.json key file had zero GSC access, so this script was
// silently returning empty reports. Fall back to a key file if no inline key.
const inlineKey = process.env.GA_SERVICE_ACCOUNT_KEY || process.env.GCP_SA_KEY;
const auth = new google.auth.GoogleAuth({
  ...(inlineKey
    ? { credentials: JSON.parse(inlineKey) }
    : {
        keyFile:
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          `${process.env.HOME}/.gcp-keys/autoclaw-analytics-sa.json`,
      }),
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
});
const sc = google.searchconsole({ version: "v1", auth });

const today = new Date();
const endDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000); // GSC has 2-3 day lag
const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000);
const iso = (d) => d.toISOString().slice(0, 10);

async function q(dimensions, rowLimit = 100) {
  const { data } = await sc.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: iso(startDate),
      endDate: iso(endDate),
      dimensions,
      rowLimit,
    },
  });
  return data.rows || [];
}

console.log(`Site:   ${SITE_URL}`);
console.log(`Window: ${iso(startDate)} → ${iso(endDate)} (28 days)\n`);

// --- Sanity: site is verified for this SA ---
try {
  const { data } = await sc.sites.list();
  const me = (data.siteEntry || []).find((s) => s.siteUrl === `${SITE_URL}/` || s.siteUrl === SITE_URL);
  if (!me) {
    console.error(
      `✗ ${SITE_URL} is not visible to this service account.\n  Make sure you added the SA email as a user in GSC and the site URL above matches exactly (with or without trailing /).`,
    );
    process.exit(1);
  }
  console.log(`✓ verified site (permissionLevel=${me.permissionLevel})\n`);
} catch (e) {
  console.error("✗ sites.list failed:", e.message);
  process.exit(1);
}

// --- Pull 4 dimensions in parallel ---
const [byQuery, byPage, byCountry, byDevice] = await Promise.all([
  q(["query"], 100),
  q(["page"], 100),
  q(["country"], 20),
  q(["device"], 5),
]);

// --- Compute aggregate metrics ---
const totals = (rows) =>
  rows.reduce(
    (a, r) => ({
      clicks: a.clicks + (r.clicks || 0),
      impressions: a.impressions + (r.impressions || 0),
    }),
    { clicks: 0, impressions: 0 },
  );
const all = totals(byPage);
const overall = {
  clicks: all.clicks,
  impressions: all.impressions,
  ctr: all.impressions ? all.clicks / all.impressions : 0,
};

const writeJson = `${OUT_DIR}/${iso(endDate)}.json`;
fs.writeFileSync(
  writeJson,
  JSON.stringify({ window: { start: iso(startDate), end: iso(endDate) }, overall, byQuery, byPage, byCountry, byDevice }, null, 2),
);

// --- Action items ---
// 1. Low-CTR but ranking pages (top 20 position, CTR < 1%) → bad title/desc
const lowCtrPages = byPage
  .filter((r) => r.position < 21 && r.impressions >= 20 && r.ctr < 0.01)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 10);

// 2. Near-page-1 queries (position 11-20) → easy wins with content tweak
const nearTop = byQuery
  .filter((r) => r.position > 10 && r.position < 21 && r.impressions >= 10)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 10);

// 3. Top-performing pages
const topPages = byPage.slice(0, 10);
const topQueries = byQuery.slice(0, 10);

// --- Markdown digest ---
const fmtPct = (x) => `${(x * 100).toFixed(2)}%`;
const fmtNum = (x) => x.toLocaleString();
const fmtPos = (x) => x.toFixed(1);
const shortUrl = (u) => u.replace(SITE_URL, "");

const md = `# SEO digest · ${iso(endDate)}

**Window**: last 28 days (${iso(startDate)} → ${iso(endDate)})
**Site**: ${SITE_URL}

## Overall

| Clicks | Impressions | CTR | Pages with traffic |
|-------:|------------:|----:|-------------------:|
| ${fmtNum(overall.clicks)} | ${fmtNum(overall.impressions)} | ${fmtPct(overall.ctr)} | ${byPage.length} |

## Top 10 queries (by impressions)

| Query | Imp | Clicks | CTR | Pos |
|---|---:|---:|---:|---:|
${topQueries
  .map(
    (r) =>
      `| ${r.keys[0].slice(0, 50)} | ${fmtNum(r.impressions)} | ${r.clicks} | ${fmtPct(r.ctr)} | ${fmtPos(r.position)} |`,
  )
  .join("\n")}

## Top 10 pages (by impressions)

| Page | Imp | Clicks | CTR | Pos |
|---|---:|---:|---:|---:|
${topPages
  .map(
    (r) =>
      `| ${shortUrl(r.keys[0]).slice(0, 60)} | ${fmtNum(r.impressions)} | ${r.clicks} | ${fmtPct(r.ctr)} | ${fmtPos(r.position)} |`,
  )
  .join("\n")}

## 🎯 Action items

### A. Low-CTR pages ranking on page 1-2 — fix titles/descriptions

These pages already rank in top 20 but barely get clicked. Most likely cause:
generic / non-compelling title/description. **Highest ROI SEO improvement.**

${lowCtrPages.length === 0 ? "_(no pages meeting the threshold yet — usually appears once a site has >100 impressions/day)_" : lowCtrPages
  .map(
    (r, i) =>
      `${i + 1}. \`${shortUrl(r.keys[0])}\` — ${fmtNum(r.impressions)} imp, pos ${fmtPos(r.position)}, CTR ${fmtPct(r.ctr)}`,
  )
  .join("\n")}

### B. Near-top-of-page-1 queries — push from pos 11-20 to top 10

Each query below is **one rank away** from page-1 traffic. Add content
addressing them or build internal links to relevant pages.

${nearTop.length === 0 ? "_(no queries meeting the threshold yet)_" : nearTop
  .map(
    (r, i) =>
      `${i + 1}. "${r.keys[0]}" — ${fmtNum(r.impressions)} imp, pos ${fmtPos(r.position)}, CTR ${fmtPct(r.ctr)}`,
  )
  .join("\n")}

### C. Geography / device split

| Country | Clicks | Imp |
|---|---:|---:|
${byCountry
  .slice(0, 5)
  .map((r) => `| ${r.keys[0].toUpperCase()} | ${r.clicks} | ${fmtNum(r.impressions)} |`)
  .join("\n")}

| Device | Clicks | Imp | CTR |
|---|---:|---:|---:|
${byDevice
  .map(
    (r) =>
      `| ${r.keys[0]} | ${r.clicks} | ${fmtNum(r.impressions)} | ${fmtPct(r.ctr)} |`,
  )
  .join("\n")}

---
_Generated by \`scripts/gsc-pull.mjs\`. Raw data: [\`${iso(endDate)}.json\`](./${iso(endDate)}.json)._
`;

const writeMd = `${OUT_DIR}/${iso(endDate)}.md`;
fs.writeFileSync(writeMd, md);

console.log(`✓ wrote ${writeJson}`);
console.log(`✓ wrote ${writeMd}\n`);
console.log("--- Summary ---");
console.log(`clicks=${overall.clicks} impressions=${overall.impressions} CTR=${fmtPct(overall.ctr)}`);
console.log(`actionable low-CTR pages: ${lowCtrPages.length}`);
console.log(`actionable near-top queries: ${nearTop.length}`);
