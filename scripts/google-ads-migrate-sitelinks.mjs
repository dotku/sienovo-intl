#!/usr/bin/env node

/**
 * One-shot migrator: replace customer-level sitelinks pointing at the
 * old `sienovo.jytech.us` domain with fresh ones pointing at
 * `intl.sienovo.cn`. Required because the Ads campaign hit
 * "Destination mismatch" — the displayed final URL no longer matched
 * the landing page (jytech.us 301-redirects to intl.sienovo.cn).
 *
 * Ads API note: `Asset.finalUrls` is immutable. You cannot UPDATE an
 * existing sitelink's URL — must create a new Asset and remove the
 * old CustomerAsset link.
 *
 * Strategy (atomic):
 *   1. Find every CustomerAsset SITELINK whose Asset.finalUrls contains
 *      the legacy domain
 *   2. Create a fresh Asset with the same linkText + descriptions but
 *      the new domain URL
 *   3. Single mutate: remove old CustomerAsset link + create new one
 *
 * Usage:
 *   node scripts/google-ads-migrate-sitelinks.mjs --dry-run
 *   node scripts/google-ads-migrate-sitelinks.mjs
 *   node scripts/google-ads-migrate-sitelinks.mjs --from sienovo.jytech.us --to intl.sienovo.cn
 */

import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const FROM_DOMAIN = args.includes("--from") ? args[args.indexOf("--from") + 1] : "sienovo.jytech.us";
const TO_DOMAIN = args.includes("--to") ? args[args.indexOf("--to") + 1] : "intl.sienovo.cn";

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

function hdrs(t) {
  const h = {
    Authorization: `Bearer ${t}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (LCID) h["login-customer-id"] = LCID;
  return h;
}

async function gaql(t, q) {
  const r = await fetch(
    `https://googleads.googleapis.com/${API}/customers/${CID}/googleAds:searchStream`,
    { method: "POST", headers: hdrs(t), body: JSON.stringify({ query: q }) }
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
  console.log(`Customer: ${CID}`);
  console.log(`Migrating sitelinks: ${FROM_DOMAIN} → ${TO_DOMAIN}\n`);

  // 1. Pull every customer-level SITELINK with full asset details
  const links = await gaql(
    t,
    `SELECT customer_asset.resource_name, customer_asset.status,
            asset.id, asset.resource_name, asset.name,
            asset.final_urls,
            asset.sitelink_asset.link_text,
            asset.sitelink_asset.description1,
            asset.sitelink_asset.description2
     FROM customer_asset
     WHERE customer_asset.field_type = 'SITELINK'
       AND customer_asset.status != 'REMOVED'`
  );

  console.log(`Total active SITELINK customer assets: ${links.length}`);
  const stale = [];
  const fresh = [];
  for (const r of links) {
    const urls = r.asset.finalUrls || [];
    const hasOld = urls.some((u) => u.includes(FROM_DOMAIN));
    if (hasOld) stale.push(r);
    else fresh.push(r);
  }
  console.log(`  Stale (point at ${FROM_DOMAIN}): ${stale.length}`);
  for (const s of stale) {
    console.log(`    "${s.asset.sitelinkAsset?.linkText}" → ${s.asset.finalUrls[0]}`);
  }
  console.log(`  OK (already on ${TO_DOMAIN} or other): ${fresh.length}`);

  if (stale.length === 0) {
    console.log("\nNothing to migrate.");
    return;
  }

  if (DRY) {
    console.log(`\n(dry-run) Would create ${stale.length} new sitelinks and detach old ones.`);
    return;
  }

  // 2. Create fresh Asset entities mirroring text + descriptions
  console.log(`\n[1/2] Creating ${stale.length} replacement Sitelink assets…`);
  const createOps = stale.map((s) => {
    const sa = s.asset.sitelinkAsset || {};
    const newUrls = (s.asset.finalUrls || []).map((u) =>
      u.replace(new RegExp(FROM_DOMAIN.replace(/\./g, "\\."), "g"), TO_DOMAIN)
    );
    return {
      create: {
        name: `Sitelink: ${sa.linkText} (${TO_DOMAIN})`,
        sitelinkAsset: {
          linkText: sa.linkText,
          description1: sa.description1,
          description2: sa.description2,
        },
        finalUrls: newUrls,
      },
    };
  });
  const assetResp = await mutate(t, "assets", createOps);
  const newAssetRns = assetResp.results.map((r) => r.resourceName);
  newAssetRns.forEach((rn, i) =>
    console.log(`  ✓ "${stale[i].asset.sitelinkAsset.linkText}" → ${rn}`)
  );

  // 3. Atomic swap: remove old customer-asset links + link new ones
  console.log(`\n[2/2] Swapping customer-asset links (${stale.length} remove + ${newAssetRns.length} create)…`);
  const swapOps = [
    ...stale.map((s) => ({ remove: s.customerAsset.resourceName })),
    ...newAssetRns.map((rn) => ({
      create: {
        asset: rn,
        fieldType: "SITELINK",
      },
    })),
  ];
  const swapResp = await mutate(t, "customerAssets", swapOps);
  console.log(`  ✓ ${swapResp.results.length} operations succeeded`);

  console.log(`\n🎉 Done. Verify in Ads UI → Assets → Sitelinks.`);
})().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
