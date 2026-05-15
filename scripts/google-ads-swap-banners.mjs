#!/usr/bin/env node

/**
 * Swap Asset Group 1's current Chinese banner-* and sq-* image assets with
 * the freshly-uploaded Sienovo English banners. Keeps language-agnostic
 * placeholders (icon.png, "Free stock image *") so total coverage stays
 * roughly intact.
 *
 * Plan:
 *   1. List every ENABLED image asset linked to Asset Group 1
 *   2. Decide: keep (icon.png + Free stock placeholders) or remove
 *   3. Single batch mutate: REMOVE keepers + CREATE links for our 6 new
 *      English banners (assets uploaded earlier — match by asset.name
 *      "Sienovo banner *")
 *
 * Usage:
 *   node scripts/google-ads-swap-banners.mjs --dry-run   # preview
 *   node scripts/google-ads-swap-banners.mjs             # execute
 */

import { config } from "dotenv";
import { join } from "node:path";

config({ path: join(process.cwd(), ".env.local") });

const API = "v20";
const ASSET_GROUP_ID = "6709171365";
const CID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
const LCID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

const DRY = process.argv.includes("--dry-run");

// Asset names matching these regexes survive the purge.
const KEEPERS = [
  /^icon\.png$/i,
  /^Free stock image/i,
];

// Aspect → field type for mapping our new banner files
const ASPECT_TO_FIELD = {
  "191x100": "MARKETING_IMAGE",
  "1x1": "SQUARE_MARKETING_IMAGE",
  "4x5": "PORTRAIT_MARKETING_IMAGE",
  "9x16": "TALL_PORTRAIT_MARKETING_IMAGE",
};

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

function parseEnglishBannerName(name) {
  // "Sienovo banner int-aibox-p-8 191x100" → { slug, aspect }
  const m = name.match(/^Sienovo banner (.+) (191x100|1x1|4x5|9x16)$/);
  return m ? { slug: m[1], aspect: m[2] } : null;
}

(async () => {
  const t = await token();
  console.log(`Customer: ${CID}, Asset Group: ${ASSET_GROUP_ID}\n`);

  // 1. Current ENABLED image links
  const enabled = await gaql(
    t,
    `SELECT asset.id, asset.name,
            asset_group_asset.field_type, asset_group_asset.resource_name
     FROM asset_group_asset
     WHERE asset_group.id = ${ASSET_GROUP_ID}
       AND asset.type = 'IMAGE'
       AND asset_group_asset.status = 'ENABLED'`
  );

  const toRemove = [];
  const toKeep = [];
  for (const row of enabled) {
    const name = row.asset?.name || "(no name)";
    const isKeeper = KEEPERS.some((re) => re.test(name));
    (isKeeper ? toKeep : toRemove).push({
      name,
      fieldType: row.assetGroupAsset.fieldType,
      linkRn: row.assetGroupAsset.resourceName,
    });
  }

  console.log(`Current ENABLED: ${enabled.length}`);
  console.log(`  Keep (icon / stock placeholder): ${toKeep.length}`);
  toKeep.forEach((k) => console.log(`    ✓ ${k.name}  [${k.fieldType}]`));
  console.log(`  Remove (Chinese / banner-* / sq-*): ${toRemove.length}`);
  toRemove.forEach((r) => console.log(`    ✗ ${r.name}  [${r.fieldType}]`));

  // 2. Locate our pre-uploaded English banner assets by name
  const allEnglish = await gaql(
    t,
    `SELECT asset.id, asset.resource_name, asset.name
     FROM asset
     WHERE asset.type = 'IMAGE'
       AND asset.name LIKE 'Sienovo banner%'`
  );
  console.log(`\nEnglish banner assets in account: ${allEnglish.length}`);

  // Existing English links so we don't double-link
  const linkedEnglish = await gaql(
    t,
    `SELECT asset.resource_name, asset_group_asset.field_type
     FROM asset_group_asset
     WHERE asset_group.id = ${ASSET_GROUP_ID}
       AND asset_group_asset.status != 'REMOVED'`
  );
  const linkedSet = new Set(
    linkedEnglish.map((r) => `${r.asset.resourceName}|${r.assetGroupAsset.fieldType}`)
  );

  const toLink = [];
  for (const a of allEnglish) {
    const parsed = parseEnglishBannerName(a.asset.name);
    if (!parsed) continue;
    const ft = ASPECT_TO_FIELD[parsed.aspect];
    const key = `${a.asset.resourceName}|${ft}`;
    if (linkedSet.has(key)) continue;
    toLink.push({
      asset: a.asset.resourceName,
      fieldType: ft,
      name: a.asset.name,
    });
  }

  console.log(`To link (new English): ${toLink.length}`);
  toLink.forEach((l) => console.log(`    + ${l.name}  [${l.fieldType}]`));

  // 3. Math check: post-swap total = toKeep + toLink
  const postTotal = toKeep.length + toLink.length;
  console.log(`\nPost-swap total ENABLED images: ${postTotal} / 20 cap`);
  if (postTotal > 20) {
    console.log("⚠️  WARNING: would exceed 20 cap. Adjust KEEPERS or trim toLink.");
    return;
  }

  if (DRY) {
    console.log("\n(dry-run) Done.");
    return;
  }

  // 4. Single batch mutate: removes + creates
  const ops = [
    ...toRemove.map((r) => ({ remove: r.linkRn })),
    ...toLink.map((l) => ({
      create: {
        assetGroup: `customers/${CID}/assetGroups/${ASSET_GROUP_ID}`,
        asset: l.asset,
        fieldType: l.fieldType,
      },
    })),
  ];

  if (ops.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  console.log(`\nExecuting ${ops.length} operations (${toRemove.length} remove + ${toLink.length} create)...`);
  const resp = await mutate(t, "assetGroupAssets", ops);
  console.log(`  ✓ ${resp.results.length} operations succeeded`);

  console.log(`\n🎉 Done. Re-run audit:`);
  console.log(`   node scripts/google-ads-pmax-audit.mjs`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
