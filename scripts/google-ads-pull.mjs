// Pull Campaign 23816361748 performance + ad groups + top search terms,
// then write recommendations to data/google-ads-reports/.
//
// Run: node scripts/google-ads-pull.mjs

import { config } from "dotenv";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config({ path: join(process.cwd(), ".env.local") });

const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "23816361748";
const API_VERSION = "v20";
const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

if (!CUSTOMER_ID) {
  console.error("GOOGLE_ADS_CUSTOMER_ID missing in .env.local");
  process.exit(1);
}

async function getAccessToken() {
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
  if (!r.ok) throw new Error(`OAuth: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function query(gaql) {
  const token = await getAccessToken();
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:searchStream`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (LOGIN_CUSTOMER_ID) headers["login-customer-id"] = LOGIN_CUSTOMER_ID;
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: gaql }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`GAQL ${r.status}: ${text.slice(0, 300)}`);
  // searchStream returns NDJSON array of result chunks
  const parsed = JSON.parse(text);
  const results = [];
  const chunks = Array.isArray(parsed) ? parsed : [parsed];
  for (const c of chunks) results.push(...(c.results || []));
  return results;
}

const micros = (n) => (Number(n || 0) / 1_000_000).toFixed(2);
const pct = (n) => ((Number(n || 0)) * 100).toFixed(2) + "%";

console.log(`Customer: ${CUSTOMER_ID}, Campaign: ${CAMPAIGN_ID}, last 30 days\n`);

// 1. Campaign overview
const campaignRows = await query(`
  SELECT
    campaign.id, campaign.name, campaign.status,
    campaign.advertising_channel_type, campaign.bidding_strategy_type,
    campaign_budget.amount_micros,
    metrics.impressions, metrics.clicks, metrics.cost_micros,
    metrics.conversions, metrics.ctr, metrics.average_cpc,
    metrics.conversions_from_interactions_rate, metrics.cost_per_conversion
  FROM campaign
  WHERE campaign.id = ${CAMPAIGN_ID}
    AND segments.date DURING LAST_30_DAYS
`);

if (!campaignRows.length) {
  console.error(`✗ No data for campaign ${CAMPAIGN_ID} — check ID + login_customer_id permissions`);
  process.exit(1);
}

const c = campaignRows[0];
const cam = c.campaign;
const m = c.metrics;
const b = c.campaignBudget;

console.log("=== Campaign overview ===");
console.log(`Name:      ${cam.name}`);
console.log(`Status:    ${cam.status}`);
console.log(`Channel:   ${cam.advertisingChannelType}`);
console.log(`Bidding:   ${cam.biddingStrategyType}`);
console.log(`Budget:    $${micros(b?.amountMicros)}/day`);
console.log(``);
console.log(`Impressions:     ${m.impressions}`);
console.log(`Clicks:          ${m.clicks}`);
console.log(`Cost:            $${micros(m.costMicros)}`);
console.log(`Conversions:     ${m.conversions || 0}`);
console.log(`CTR:             ${pct(m.ctr)}`);
console.log(`Avg CPC:         $${micros(m.averageCpc)}`);
console.log(`Conv rate:       ${pct(m.conversionsFromInteractionsRate)}`);
console.log(`Cost/conv:       $${micros(m.costPerConversion)}`);

// 2. Ad groups
const adGroups = await query(`
  SELECT
    ad_group.id, ad_group.name, ad_group.status,
    metrics.impressions, metrics.clicks, metrics.cost_micros,
    metrics.conversions, metrics.ctr, metrics.average_cpc
  FROM ad_group
  WHERE campaign.id = ${CAMPAIGN_ID}
    AND segments.date DURING LAST_30_DAYS
  ORDER BY metrics.cost_micros DESC
`);
console.log(`\n=== Ad groups (${adGroups.length}) ===`);
for (const r of adGroups.slice(0, 10)) {
  const g = r.adGroup;
  const gm = r.metrics;
  console.log(
    `  [${g.status}] ${g.name.padEnd(40).slice(0, 40)}  imp=${(gm.impressions || 0).toString().padStart(6)}  clk=${(gm.clicks || 0).toString().padStart(4)}  cost=$${micros(gm.costMicros).padStart(7)}  CTR=${pct(gm.ctr).padStart(6)}`,
  );
}

// 3. Top search terms (real queries that triggered ads) — main improvement signal
const searchTerms = await query(`
  SELECT
    search_term_view.search_term,
    metrics.impressions, metrics.clicks, metrics.cost_micros,
    metrics.conversions, metrics.ctr
  FROM search_term_view
  WHERE campaign.id = ${CAMPAIGN_ID}
    AND segments.date DURING LAST_30_DAYS
    AND metrics.impressions > 5
  ORDER BY metrics.impressions DESC
  LIMIT 30
`);
console.log(`\n=== Top 20 search terms (impressions > 5) ===`);
for (const r of searchTerms.slice(0, 20)) {
  console.log(
    `  "${r.searchTermView.searchTerm}" — imp=${r.metrics.impressions} clk=${r.metrics.clicks || 0} cost=$${micros(r.metrics.costMicros)} conv=${r.metrics.conversions || 0}`,
  );
}

// 4. Keywords
const keywords = await query(`
  SELECT
    ad_group_criterion.keyword.text,
    ad_group_criterion.keyword.match_type,
    ad_group_criterion.status,
    metrics.impressions, metrics.clicks, metrics.cost_micros,
    metrics.conversions, metrics.ctr, metrics.average_cpc
  FROM keyword_view
  WHERE campaign.id = ${CAMPAIGN_ID}
    AND segments.date DURING LAST_30_DAYS
    AND ad_group_criterion.status = 'ENABLED'
  ORDER BY metrics.cost_micros DESC
  LIMIT 30
`);
console.log(`\n=== Top 15 keywords by cost ===`);
for (const r of keywords.slice(0, 15)) {
  const kw = r.adGroupCriterion.keyword;
  console.log(
    `  [${kw.matchType}] "${kw.text}" — imp=${r.metrics.impressions} clk=${r.metrics.clicks || 0} cost=$${micros(r.metrics.costMicros)} CTR=${pct(r.metrics.ctr)}`,
  );
}

// === Build recommendations ===
const recs = [];
const totalCost = Number(m.costMicros || 0) / 1_000_000;
const totalConv = Number(m.conversions || 0);
const ctr = Number(m.ctr || 0);
const convRate = Number(m.conversionsFromInteractionsRate || 0);

if (totalConv === 0 && totalCost > 0) {
  recs.push(`🔴 P0  Zero conversions in 30d while spending $${totalCost.toFixed(2)}. Either conversion tracking is not firing (check gtag setup), or no conversion action is set up in Google Ads. Verify in Ads → Tools → Conversions.`);
}
if (ctr < 0.02 && Number(m.impressions || 0) > 1000) {
  recs.push(`🟡 P1  CTR ${pct(ctr)} is below 2% benchmark. Improve ad copy + add sitelinks/extensions. Currently ad relevance to search intent is weak.`);
}
if (convRate > 0 && convRate < 0.01) {
  recs.push(`🟡 P1  Conversion rate ${pct(convRate)} is very low (<1%). Likely landing page mismatch — review which pages each ad group points to.`);
}

// Find irrelevant search terms wasting budget (cost but no clicks or no conv)
const wasteful = searchTerms.filter(
  (r) => (Number(r.metrics.costMicros || 0) > 1_000_000) && Number(r.metrics.conversions || 0) === 0,
);
if (wasteful.length > 0) {
  recs.push(`🟡 P1  ${wasteful.length} search terms cost > $1 with 0 conversions. Candidates for negative keywords:\n  ${wasteful.slice(0, 5).map((r) => `"${r.searchTermView.searchTerm}" — $${micros(r.metrics.costMicros)}`).join("\n  ")}`);
}

// Disabled ad groups under active campaign
const pausedAg = adGroups.filter((r) => r.adGroup.status !== "ENABLED").length;
if (pausedAg > 0 && adGroups.filter((r) => r.adGroup.status === "ENABLED").length < 3) {
  recs.push(`⚪ P2  Only ${adGroups.filter((r) => r.adGroup.status === "ENABLED").length} active ad groups. Consider splitting traffic across more ad groups by theme.`);
}

console.log(`\n=== 🎯 Recommendations ===`);
if (recs.length === 0) console.log("  (no major issues detected — keep iterating)");
recs.forEach((r) => console.log("\n" + r));

// Write report
mkdirSync("data/google-ads-reports", { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const report = {
  date: today,
  campaign: { id: CAMPAIGN_ID, name: cam.name, status: cam.status, bidding: cam.biddingStrategyType, budgetUsd: micros(b?.amountMicros) },
  metrics: {
    impressions: Number(m.impressions || 0), clicks: Number(m.clicks || 0),
    costUsd: totalCost, conversions: totalConv,
    ctr, avgCpcUsd: Number(m.averageCpc || 0) / 1e6, convRate,
    costPerConvUsd: Number(m.costPerConversion || 0) / 1e6,
  },
  adGroups: adGroups.map((r) => ({ name: r.adGroup.name, status: r.adGroup.status, ...r.metrics })),
  topSearchTerms: searchTerms.map((r) => ({ term: r.searchTermView.searchTerm, ...r.metrics })),
  topKeywords: keywords.map((r) => ({ text: r.adGroupCriterion.keyword.text, matchType: r.adGroupCriterion.keyword.matchType, ...r.metrics })),
  recommendations: recs,
};
writeFileSync(`data/google-ads-reports/${today}.json`, JSON.stringify(report, null, 2));
console.log(`\n✓ wrote data/google-ads-reports/${today}.json`);
