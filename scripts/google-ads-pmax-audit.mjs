// Audit Performance Max campaign 23816361748 asset coverage + strength.
// PMax doesn't use ad groups in the classic sense — it uses "asset groups"
// (creative bundles). Algorithm mixes & matches assets to serve the right
// one to the right audience. Weak/sparse assets = no audience match = no
// impressions = no conversions.
//
// Run: node scripts/google-ads-pmax-audit.mjs

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config({ path: join(process.cwd(), ".env.local") });

const CAMPAIGN_ID = "23816361748";
const API = "v20";
const CID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
const LCID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

async function token() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  return (await r.json()).access_token;
}

async function gaql(query) {
  const t = await token();
  const h = {
    Authorization: `Bearer ${t}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (LCID) h["login-customer-id"] = LCID;
  const r = await fetch(
    `https://googleads.googleapis.com/${API}/customers/${CID}/googleAds:searchStream`,
    { method: "POST", headers: h, body: JSON.stringify({ query }) },
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`GAQL ${r.status}: ${text.slice(0, 300)}`);
  const chunks = JSON.parse(text);
  const arr = Array.isArray(chunks) ? chunks : [chunks];
  return arr.flatMap((c) => c.results || []);
}

console.log(`Customer: ${CID}, PMax campaign: ${CAMPAIGN_ID}\n`);

// 1. Asset groups
const ags = await gaql(`
  SELECT asset_group.id, asset_group.name, asset_group.status, asset_group.ad_strength,
         asset_group.primary_status,
         metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
  FROM asset_group
  WHERE campaign.id = ${CAMPAIGN_ID}
    AND segments.date DURING LAST_30_DAYS
`);

console.log(`=== Asset groups (${ags.length}) ===`);
for (const r of ags) {
  const ag = r.assetGroup;
  const m = r.metrics || {};
  console.log(
    `  [${ag.status}/${ag.primaryStatus}] strength=${ag.adStrength}`,
  );
  console.log(`    "${ag.name}"`);
  console.log(
    `    imp=${m.impressions || 0}  clk=${m.clicks || 0}  cost=$${((m.costMicros || 0) / 1e6).toFixed(2)}  conv=${m.conversions || 0}`,
  );
}

// 2. Per-asset breakdown
const ASSET_LIMITS_PMAX = {
  HEADLINE: { recommended: 11, max: 15, label: "Headlines (≤30 char)" },
  LONG_HEADLINE: { recommended: 4, max: 5, label: "Long headlines (≤90 char)" },
  DESCRIPTION: { recommended: 4, max: 5, label: "Descriptions (≤90 char)" },
  CALL_TO_ACTION_SELECTION: { recommended: 1, max: 1, label: "Call to action" },
  BUSINESS_NAME: { recommended: 1, max: 1, label: "Business name" },
  MARKETING_IMAGE: { recommended: 8, max: 20, label: "Marketing images (1.91:1)" },
  SQUARE_MARKETING_IMAGE: { recommended: 8, max: 20, label: "Square images (1:1)" },
  PORTRAIT_MARKETING_IMAGE: { recommended: 4, max: 20, label: "Portrait images (4:5)" },
  LOGO: { recommended: 1, max: 5, label: "Logo (square)" },
  LANDSCAPE_LOGO: { recommended: 1, max: 5, label: "Landscape logo" },
  YOUTUBE_VIDEO: { recommended: 1, max: 5, label: "Videos (YouTube)" },
};

console.log(`\n=== Asset coverage per asset group ===`);
const allFindings = [];

for (const r of ags) {
  const agId = r.assetGroup.id;
  const agName = r.assetGroup.name;
  console.log(`\n— ${agName} (id=${agId}) —`);

  const aga = await gaql(`
    SELECT asset.id, asset.type, asset.name,
           asset.text_asset.text,
           asset.image_asset.full_size.url,
           asset.youtube_video_asset.youtube_video_id,
           asset_group_asset.field_type, asset_group_asset.performance_label,
           asset_group_asset.status
    FROM asset_group_asset
    WHERE asset_group.id = ${agId}
      AND asset_group_asset.status != 'REMOVED'
  `);

  const byField = {};
  for (const a of aga) {
    const ft = a.assetGroupAsset.fieldType;
    (byField[ft] ||= []).push(a);
  }

  for (const [field, info] of Object.entries(ASSET_LIMITS_PMAX)) {
    const count = (byField[field] || []).length;
    const enough = count >= info.recommended;
    const flag = enough ? "✅" : count > 0 ? "🟡" : "❌";
    console.log(
      `  ${flag} ${info.label.padEnd(35)} ${count}/${info.recommended} ${enough ? "" : "(below recommended)"}`,
    );
    if (!enough) {
      allFindings.push({
        assetGroup: agName,
        field,
        have: count,
        want: info.recommended,
        label: info.label,
      });
    }
  }

  // Asset performance labels
  const perfStats = {};
  for (const a of aga) {
    const pl = a.assetGroupAsset.performanceLabel || "PENDING";
    perfStats[pl] = (perfStats[pl] || 0) + 1;
  }
  console.log(`  Performance: ${JSON.stringify(perfStats)}`);
}

// === Recommendations ===
console.log(`\n=== 🎯 Recommendations ===`);

const recs = [];
const lowStrength = ags.filter(
  (r) => ["POOR", "AVERAGE"].includes(r.assetGroup.adStrength),
);
if (lowStrength.length > 0) {
  recs.push(
    `🔴 P0  ${lowStrength.length} asset group(s) have Poor/Average ad strength. PMax can't serve enough impressions without strong creative. Goal: every asset group at "Good" or "Excellent".`,
  );
}

const missingVideo = allFindings.filter((f) => f.field === "YOUTUBE_VIDEO");
if (missingVideo.length > 0) {
  recs.push(
    `🔴 P0  ${missingVideo.length} asset group(s) have no YouTube video. Google auto-generates one when missing — auto-generated PMax videos look terrible (stock images + slow zoom). Even a 15s phone-shot clip uploaded to YouTube is better. Or use a free tool: Canva / CapCut / runwayml.`,
  );
}

const missingPortrait = allFindings.filter((f) => f.field === "PORTRAIT_MARKETING_IMAGE");
if (missingPortrait.length > 0) {
  recs.push(
    `🟡 P1  ${missingPortrait.length} asset group(s) missing portrait 4:5 images — those are required for YouTube Shorts and mobile Discover placement (a big chunk of free PMax traffic).`,
  );
}

const fewHeadlines = allFindings.filter((f) => f.field === "HEADLINE");
if (fewHeadlines.length > 0) {
  recs.push(
    `🟡 P1  ${fewHeadlines.length} asset group(s) below 11 headlines. PMax mixes & matches — more headlines = more A/B coverage. Generate 5-10 more variations focused on different value props (latency, channels, AI algorithms, industrial reliability, customization).`,
  );
}

const fewDesc = allFindings.filter((f) => f.field === "DESCRIPTION");
if (fewDesc.length > 0) {
  recs.push(
    `🟡 P1  ${fewDesc.length} asset group(s) below 4 descriptions. Add benefits-focused descriptions (e.g. "12 TOPS edge AI · fanless · 40+ algorithms").`,
  );
}

if (recs.length === 0) {
  console.log("  (asset coverage looks healthy — keep iterating)");
} else {
  recs.forEach((r) => console.log("\n" + r));
}

mkdirSync("data/google-ads-reports", { recursive: true });
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  `data/google-ads-reports/pmax-audit-${today}.json`,
  JSON.stringify({ date: today, assetGroups: ags.length, gaps: allFindings, recommendations: recs }, null, 2),
);
console.log(`\n✓ wrote data/google-ads-reports/pmax-audit-${today}.json`);
