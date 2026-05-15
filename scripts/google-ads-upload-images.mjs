#!/usr/bin/env node

/**
 * Upload English banner images (public/ads/sienovo-en-*.jpg) to Google Ads as
 * IMAGE assets and link them to Asset Group 1 with the right field type
 * (MARKETING_IMAGE / SQUARE_MARKETING_IMAGE / PORTRAIT_MARKETING_IMAGE).
 *
 * Idempotent: existing assets with the same `name` are skipped.
 * Filename convention drives field type:
 *   *-191x100.jpg → MARKETING_IMAGE      (1.91:1)
 *   *-1x1.jpg     → SQUARE_MARKETING_IMAGE
 *   *-4x5.jpg     → PORTRAIT_MARKETING_IMAGE
 *   *-9x16.jpg    → TALL_PORTRAIT_MARKETING_IMAGE  (Shorts)
 *
 * Usage:
 *   node scripts/google-ads-upload-images.mjs                 # all matching files
 *   node scripts/google-ads-upload-images.mjs --dry-run       # don't write anything
 *   node scripts/google-ads-upload-images.mjs --only int-aibox-p-8
 */

import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

config({ path: join(process.cwd(), ".env.local") });

const API = "v20";
const CAMPAIGN_ID = "23816361748";
const ASSET_GROUP_ID = "6709171365";
const CID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
const LCID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/-/g, "");

const ADS_DIR = join(process.cwd(), "public/ads");
const FILE_PREFIX = "sienovo-en-";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

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
  if (!r.ok) throw new Error(`${resource} mutate ${r.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

function parseFilename(file) {
  // sienovo-en-{slug}-{aspect}.jpg
  const m = file.match(/^sienovo-en-(.+)-(191x100|1x1|4x5|9x16)\.jpg$/);
  if (!m) return null;
  return { slug: m[1], aspect: m[2], file };
}

(async () => {
  const t = await token();
  console.log(`Customer: ${CID}, Asset Group: ${ASSET_GROUP_ID}\n`);

  // Discover banners we generated
  const files = readdirSync(ADS_DIR)
    .filter((f) => f.startsWith(FILE_PREFIX) && f.endsWith(".jpg"))
    .map(parseFilename)
    .filter(Boolean)
    .filter((p) => !ONLY || p.slug === ONLY);

  console.log(`Found ${files.length} candidate banner files`);
  if (files.length === 0) {
    console.log("Nothing to upload.");
    return;
  }

  // Find existing image assets so we don't dupe (match by asset.name)
  const existing = await gaql(
    t,
    `SELECT asset.id, asset.resource_name, asset.name
     FROM asset
     WHERE asset.type = 'IMAGE'`
  );
  const existingByName = new Map();
  for (const r of existing) {
    const n = r.asset?.name;
    if (n) existingByName.set(n, r.asset.resourceName);
  }
  console.log(`Existing image assets in account: ${existingByName.size}`);

  // Existing asset_group_asset rows so we don't double-link
  const linked = await gaql(
    t,
    `SELECT asset.resource_name, asset_group_asset.field_type
     FROM asset_group_asset
     WHERE asset_group.id = ${ASSET_GROUP_ID}
       AND asset_group_asset.status != 'REMOVED'`
  );
  const linkedSet = new Set(
    linked.map((r) => `${r.asset.resourceName}|${r.assetGroupAsset.fieldType}`)
  );

  // Build asset create operations
  const planUpload = [];
  const planReuse = [];
  for (const p of files) {
    const name = `Sienovo banner ${p.slug} ${p.aspect}`;
    const existingRn = existingByName.get(name);
    if (existingRn) {
      planReuse.push({ ...p, name, resourceName: existingRn });
    } else {
      planUpload.push({ ...p, name });
    }
  }

  console.log(`\nPlan:`);
  console.log(`  Upload new: ${planUpload.length}`);
  planUpload.forEach((p) => console.log(`    ${p.file} → ${ASPECT_TO_FIELD[p.aspect]}`));
  console.log(`  Reuse existing: ${planReuse.length}`);
  planReuse.forEach((p) => console.log(`    ${p.file} → ${ASPECT_TO_FIELD[p.aspect]}`));

  if (DRY) {
    console.log("\n(dry-run) Done.");
    return;
  }

  // Step 1: upload new images as Asset entities
  if (planUpload.length > 0) {
    console.log(`\n[1/2] Uploading ${planUpload.length} image asset(s)...`);
    const operations = planUpload.map((p) => {
      const buf = readFileSync(join(ADS_DIR, p.file));
      return {
        create: {
          name: p.name,
          type: "IMAGE",
          imageAsset: {
            data: buf.toString("base64"),
            mimeType: "IMAGE_JPEG",
          },
        },
      };
    });
    const resp = await mutate(t, "assets", operations);
    resp.results.forEach((r, i) => {
      planUpload[i].resourceName = r.resourceName;
      console.log(`  ✓ ${planUpload[i].file} → ${r.resourceName}`);
    });
  } else {
    console.log("\n[1/2] No new images to upload");
  }

  // Step 2: link every banner (new + reused) to the asset group with the
  // right field type, skipping any (asset, field_type) pair already linked
  const allBanners = [...planUpload, ...planReuse];
  const linkOps = allBanners
    .map((p) => {
      const fieldType = ASPECT_TO_FIELD[p.aspect];
      const key = `${p.resourceName}|${fieldType}`;
      if (linkedSet.has(key)) {
        console.log(`  skip (already linked): ${p.file} as ${fieldType}`);
        return null;
      }
      return {
        create: {
          assetGroup: `customers/${CID}/assetGroups/${ASSET_GROUP_ID}`,
          asset: p.resourceName,
          fieldType,
        },
        _meta: p,
      };
    })
    .filter(Boolean);

  if (linkOps.length === 0) {
    console.log(`\n[2/2] Everything already linked to Asset Group 1`);
  } else {
    console.log(`\n[2/2] Linking ${linkOps.length} asset(s) to Asset Group 1...`);
    const cleanOps = linkOps.map(({ create }) => ({ create }));
    const linkResp = await mutate(t, "assetGroupAssets", cleanOps);
    linkResp.results.forEach((r, i) => {
      const meta = linkOps[i]._meta;
      console.log(`  ✓ ${meta.file} → ${ASPECT_TO_FIELD[meta.aspect]}`);
    });
  }

  console.log(`\n🎉 Done. Re-run audit:`);
  console.log(`   node scripts/google-ads-pmax-audit.mjs`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
