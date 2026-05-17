#!/usr/bin/env node

/**
 * Replace the existing PMax LANDSCAPE_LOGO at campaign level with a new
 * user-provided image (public/ads/dd7e38ad-*.png).
 *
 * Steps:
 *   1. Upload the new PNG as an IMAGE asset
 *   2. Find the current LANDSCAPE_LOGO campaign_asset link
 *   3. Atomic mutate: remove old link + create new link
 *
 * Usage:
 *   node scripts/google-ads-swap-landscape-logo.mjs --file public/ads/dd7e38ad-b973-4d81-a5d2-b68c0250737d.png
 *   node scripts/google-ads-swap-landscape-logo.mjs --file <path> --dry-run
 */

import { config } from "dotenv";
import { readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";

config({ path: join(process.cwd(), ".env.local") });

const API = "v20";
const CAMPAIGN_ID = "23816361748";
const CID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
const LCID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

const args = process.argv.slice(2);
const FILE = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const DRY = args.includes("--dry-run");

if (!FILE) {
  console.error("Usage: --file <path-to-png>");
  process.exit(1);
}

const filePath = join(process.cwd(), FILE);
if (!statSync(filePath).isFile()) {
  console.error(`Not a file: ${filePath}`);
  process.exit(1);
}

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

function hdrs(t) {
  const h = {
    Authorization: `Bearer ${t}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (LCID) h["login-customer-id"] = LCID;
  return h;
}

async function gaql(t, query) {
  const r = await fetch(
    `https://googleads.googleapis.com/${API}/customers/${CID}/googleAds:searchStream`,
    { method: "POST", headers: hdrs(t), body: JSON.stringify({ query }) }
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`GAQL ${r.status}: ${text.slice(0, 400)}`);
  const chunks = JSON.parse(text);
  const arr = Array.isArray(chunks) ? chunks : [chunks];
  return arr.flatMap((c) => c.results || []);
}

async function mutate(t, resource, operations) {
  const r = await fetch(
    `https://googleads.googleapis.com/${API}/customers/${CID}/${resource}:mutate`,
    { method: "POST", headers: hdrs(t), body: JSON.stringify({ operations }) }
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`${resource} mutate ${r.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

(async () => {
  const t = await token();
  console.log(`Customer: ${CID}, Campaign: ${CAMPAIGN_ID}`);
  console.log(`New landscape logo file: ${FILE}\n`);

  // 1. Find current LANDSCAPE_LOGO campaign asset link
  const existing = await gaql(
    t,
    `SELECT campaign.id, asset.id, asset.name,
            campaign_asset.field_type, campaign_asset.resource_name
     FROM campaign_asset
     WHERE campaign.id = ${CAMPAIGN_ID}
       AND campaign_asset.field_type = 'LANDSCAPE_LOGO'
       AND campaign_asset.status != 'REMOVED'`
  );
  console.log(`Current LANDSCAPE_LOGO links: ${existing.length}`);
  for (const r of existing) {
    console.log(`  - asset id=${r.asset.id} name="${r.asset.name}" linkRn=${r.campaignAsset.resourceName}`);
  }

  // 2. Decide plan
  const mime = FILE.toLowerCase().endsWith(".png") ? "IMAGE_PNG" : "IMAGE_JPEG";
  const assetName = `Sienovo landscape logo ${new Date().toISOString().slice(0, 10)}`;
  console.log(`\nPlan:`);
  console.log(`  Upload: "${assetName}" (${mime})`);
  console.log(`  Remove: ${existing.length} existing LANDSCAPE_LOGO link(s)`);
  console.log(`  Create: 1 new LANDSCAPE_LOGO link`);

  if (DRY) {
    console.log("\n(dry-run) Done.");
    return;
  }

  // 3. Upload the new asset
  console.log(`\n[1/2] Uploading new landscape logo...`);
  const buf = readFileSync(filePath);
  const assetResp = await mutate(t, "assets", [
    {
      create: {
        name: assetName,
        type: "IMAGE",
        imageAsset: {
          data: buf.toString("base64"),
          mimeType: mime,
        },
      },
    },
  ]);
  const newAssetRn = assetResp.results[0].resourceName;
  console.log(`  ✓ uploaded ${newAssetRn}`);

  // 4. Single batch mutate on campaignAssets: remove old + create new
  console.log(`\n[2/2] Swapping link at campaign level...`);
  const ops = [
    ...existing.map((r) => ({ remove: r.campaignAsset.resourceName })),
    {
      create: {
        campaign: `customers/${CID}/campaigns/${CAMPAIGN_ID}`,
        asset: newAssetRn,
        fieldType: "LANDSCAPE_LOGO",
      },
    },
  ];
  const linkResp = await mutate(t, "campaignAssets", ops);
  console.log(`  ✓ ${linkResp.results.length} operations succeeded`);

  console.log(`\n🎉 Landscape logo swapped. Re-run audit:`);
  console.log(`   node scripts/google-ads-pmax-audit.mjs`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
