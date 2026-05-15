#!/usr/bin/env node

/**
 * Create the 6 PMax sitelinks that show up under our main ad and lift CTR
 * +10-15%. Currently the Sienovo campaign has 0 sitelinks at every level.
 *
 * Strategy: attach at the CUSTOMER (account) level so every campaign
 * inherits them by default. Idempotent — re-running skips sitelinks whose
 * link_text already exists.
 *
 * Reversible: the user can remove any sitelink in the Ads UI under
 * Assets → Sitelinks.
 *
 * Usage: node scripts/google-ads-create-sitelinks.mjs
 */

import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

const API = "v20";
const CID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
const LCID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

const SITELINKS = [
  {
    linkText: "INT-AIBOX-P-8",
    description1: "8-CH edge AI, 7.2 TOPS",
    description2: "From $1,299",
    finalUrls: ["https://sienovo.jytech.us/products/int-aibox-p-8"],
  },
  {
    linkText: "INT-AIBOX-RK-4",
    description1: "RK3588 NPU, 4-CH fanless",
    description2: "Entry-level $699",
    finalUrls: ["https://sienovo.jytech.us/products/int-aibox-rk-4"],
  },
  {
    linkText: "Edge AI Server",
    description1: "192 TOPS, 1U rack",
    description2: "SE10-U0 enterprise",
    finalUrls: ["https://sienovo.jytech.us/products/se10-u0"],
  },
  {
    linkText: "IoT Gateway",
    description1: "RK3588, 4G/5G + 4xRJ45",
    description2: "XM3588-GW01 $549",
    finalUrls: ["https://sienovo.jytech.us/products/xm3588-gw01"],
  },
  {
    linkText: "Marine IoT",
    description1: "Vessel tracking telemetry",
    description2: "Bait boat / patrol fleet",
    finalUrls: ["https://sienovo.jytech.us/products/marine-system"],
  },
  {
    linkText: "Technical Blog",
    description1: "1300+ engineering articles",
    description2: "RK3588 / Jetson / edge AI",
    finalUrls: ["https://sienovo.jytech.us/blog"],
  },
];

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

function headers(t) {
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
    { method: "POST", headers: headers(t), body: JSON.stringify({ query }) }
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`GAQL ${r.status}: ${text.slice(0, 300)}`);
  const chunks = JSON.parse(text);
  const arr = Array.isArray(chunks) ? chunks : [chunks];
  return arr.flatMap((c) => c.results || []);
}

async function mutate(t, resource, operations) {
  const r = await fetch(
    `https://googleads.googleapis.com/${API}/customers/${CID}/${resource}:mutate`,
    { method: "POST", headers: headers(t), body: JSON.stringify({ operations }) }
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`${resource} mutate ${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

(async () => {
  const t = await token();
  console.log(`Customer: ${CID}\n`);

  // Look for sitelinks anywhere in the account — both linked (customer_asset)
  // and unlinked (asset table) — so a previous half-failed run won't dupe.
  const allAssets = await gaql(
    t,
    `SELECT asset.id, asset.resource_name, asset.sitelink_asset.link_text
     FROM asset
     WHERE asset.type = 'SITELINK'`
  );
  const existingTexts = new Map();
  for (const r of allAssets) {
    const text = r.asset?.sitelinkAsset?.linkText;
    const rn = r.asset?.resourceName;
    if (text && rn) existingTexts.set(text, rn);
  }
  console.log(`Existing sitelink assets (any state): ${existingTexts.size}`);
  for (const text of existingTexts.keys()) console.log(`  - "${text}"`);

  // Plan: for each desired sitelink, either reuse existing asset or create.
  // Then check whether it's already linked to the customer and link if not.
  const toCreate = SITELINKS.filter((s) => !existingTexts.has(s.linkText));
  console.log(`\nTo create: ${toCreate.length}`);
  for (const s of toCreate) console.log(`  - "${s.linkText}" → ${s.finalUrls[0]}`);

  let resourceNames = [];
  if (toCreate.length > 0) {
    console.log(`\n[1/2] Creating ${toCreate.length} Asset entities...`);
    const assetOps = toCreate.map((s) => ({
      create: {
        name: `Sitelink: ${s.linkText}`,
        sitelinkAsset: {
          linkText: s.linkText,
          description1: s.description1,
          description2: s.description2,
        },
        finalUrls: s.finalUrls,
      },
    }));
    const assetResp = await mutate(t, "assets", assetOps);
    const newRns = assetResp.results.map((r) => r.resourceName);
    console.log(`  ✓ created ${newRns.length} assets`);
    newRns.forEach((n, i) => {
      console.log(`    ${toCreate[i].linkText} → ${n}`);
      existingTexts.set(toCreate[i].linkText, n);
    });
  } else {
    console.log("\n[1/2] All sitelink assets exist — skipping create");
  }

  // Collect resource names for every sitelink we want linked (whether new or
  // pre-existing).
  resourceNames = SITELINKS.map((s) => existingTexts.get(s.linkText)).filter(Boolean);

  // Step 2: which of those are NOT yet linked at customer level?
  const linked = await gaql(
    t,
    `SELECT asset.resource_name
     FROM customer_asset
     WHERE customer_asset.field_type = 'SITELINK'
       AND customer_asset.status != 'REMOVED'`
  );
  const linkedSet = new Set(linked.map((r) => r.asset.resourceName));
  const toLink = resourceNames.filter((rn) => !linkedSet.has(rn));

  console.log(`\n[2/2] Linking to customer (account level): ${toLink.length} new`);
  if (toLink.length === 0) {
    console.log("  ✓ all sitelinks already linked at customer level — nothing to do");
  } else {
    const linkOps = toLink.map((rn) => ({
      create: {
        // CustomerAsset operations don't carry a `customer` field —
        // the customer is implicit from the URL path. Schema just needs
        // `asset` + `fieldType`.
        asset: rn,
        fieldType: "SITELINK",
      },
    }));
    const linkResp = await mutate(t, "customerAssets", linkOps);
    console.log(`  ✓ linked ${linkResp.results.length} customer assets`);
  }

  console.log(`\n🎉 Done. Sitelinks visible in:`);
  console.log(`  Ads UI → Assets → Sitelinks  (account level)`);
  console.log(`  Or re-run: node scripts/google-ads-pmax-audit.mjs`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
