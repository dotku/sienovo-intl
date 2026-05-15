#!/usr/bin/env node
/**
 * Sync ad creative assets from szxinmai.com (the same company's CN-only site)
 * into public/imported/, then process them into Google Ads PMax aspect ratios
 * and save to public/ads/.
 *
 * Internal asset reuse — szxinmai.com and sienovo.jytech.us are both
 * Sienovo / 深圳信迈 properties. Do NOT point this at third-party domains.
 *
 * Usage:
 *   node scripts/sync-ads-assets.mjs              # download + process
 *   node scripts/sync-ads-assets.mjs --no-fetch   # process existing imports only
 *   node scripts/sync-ads-assets.mjs --dry-run    # show what would happen
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const IMPORTED = path.join(ROOT, "public/imported");
const ADS = path.join(ROOT, "public/ads");
const DRY = process.argv.includes("--dry-run");
const NO_FETCH = process.argv.includes("--no-fetch");

// ── Source manifest ─────────────────────────────────────────────────────────
// Each entry: { url, kind: "square" | "banner", localName }
// kind drives which PMax ratios we generate from it.
const SOURCES = [
  // 5 square product mockups (1094×1094)
  { url: "https://szxinmai.com/uploadfile/2022/0110/20220110103507340.png", kind: "square", localName: "sq-01.png" },
  { url: "https://szxinmai.com/uploadfile/2022/0130/20220130020509967.png", kind: "square", localName: "sq-02.png" },
  { url: "https://szxinmai.com/uploadfile/2022/0130/20220130022206451.png", kind: "square", localName: "sq-03.png" },
  { url: "https://szxinmai.com/uploadfile/2022/0130/20220130120148582.png", kind: "square", localName: "sq-04.png" },
  { url: "https://szxinmai.com/uploadfile/2022/0130/20220130120226604.png", kind: "square", localName: "sq-05.png" },
  // 7 hero banners (1920×750, ratio 2.56:1)
  { url: "https://szxinmai.com/uploadfile/2022/0107/20220107102416991.png", kind: "banner", localName: "banner-01.png" },
  { url: "https://szxinmai.com/uploadfile/2022/0107/20220107104540320.jpg", kind: "banner", localName: "banner-02.jpg" },
  { url: "https://szxinmai.com/uploadfile/2022/0108/20220108120444337.png", kind: "banner", localName: "banner-03.png" },
  { url: "https://szxinmai.com/uploadfile/2022/0108/20220108120546642.jpg", kind: "banner", localName: "banner-04.jpg" },
  { url: "https://szxinmai.com/uploadfile/2022/0108/20220108120929103.jpg", kind: "banner", localName: "banner-05.jpg" },
  { url: "https://szxinmai.com/uploadfile/2023/0510/20230510042052446.jpg", kind: "banner", localName: "banner-06.jpg" },
  { url: "https://szxinmai.com/uploadfile/2023/0510/20230510052621113.jpg", kind: "banner", localName: "banner-07.jpg" },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const sh = (cmd) => {
  if (DRY) { console.log(`  [DRY] ${cmd}`); return; }
  execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] });
};

async function download(url, dest) {
  if (NO_FETCH) return;
  if (DRY) { console.log(`  [DRY] GET ${url} → ${dest}`); return; }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

// sips is built into macOS; on Linux runners we fall back to ImageMagick.
const haveSips = (() => {
  try { execSync("command -v sips", { stdio: "ignore" }); return true; }
  catch { return false; }
})();
const haveMagick = (() => {
  try { execSync("command -v magick", { stdio: "ignore" }); return true; }
  catch {
    try { execSync("command -v convert", { stdio: "ignore" }); return true; }
    catch { return false; }
  }
})();

function magickBin() {
  try { execSync("command -v magick", { stdio: "ignore" }); return "magick"; }
  catch { return "convert"; }
}

/** Crop+resize the input to exact width×height JPEG, center-anchored, white bg. */
function fitCenterCrop(input, output, width, height) {
  if (haveMagick) {
    // -flatten composites alpha onto white; -quality 88 is a good size/quality balance
    sh(`${magickBin()} "${input}" -resize "${width}x${height}^" -gravity center -extent ${width}x${height} -background white -flatten -quality 88 "${output}"`);
  } else if (haveSips) {
    // sips: resize-fill, crop, then force JPEG format (drops alpha onto its own bg)
    const bigger = Math.max(width, height) * 2;
    sh(`sips -Z ${bigger} "${input}" --out "${output}"`);
    sh(`sips -c ${height} ${width} "${output}"`);
    sh(`sips -s format jpeg "${output}" --out "${output}"`);
  } else {
    throw new Error("Neither ImageMagick nor sips available");
  }
}

/** Resize to a max dimension while preserving aspect (no crop). */
function resizeMax(input, output, maxDim) {
  if (haveMagick) {
    sh(`${magickBin()} "${input}" -resize "${maxDim}x${maxDim}" "${output}"`);
  } else {
    sh(`sips -Z ${maxDim} "${input}" --out "${output}"`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
fs.mkdirSync(IMPORTED, { recursive: true });
fs.mkdirSync(ADS, { recursive: true });

console.log(`Tool: ${haveMagick ? "ImageMagick" : haveSips ? "sips" : "NONE"}`);
console.log(`Sources: ${SOURCES.length}`);
console.log(`Target ratios: 1:1 (1200×1200) · 1.91:1 (1200×628) · 4:5 (960×1200)\n`);

console.log("=== 1. Download sources ===");
for (const s of SOURCES) {
  const dest = path.join(IMPORTED, s.localName);
  if (!NO_FETCH && (!fs.existsSync(dest) || fs.statSync(dest).size < 10_000)) {
    await download(s.url, dest);
    console.log(`  ↓ ${s.localName}`);
  } else if (NO_FETCH) {
    console.log(`  · ${s.localName} (skip fetch)`);
  } else {
    console.log(`  · ${s.localName} (cached)`);
  }
}

console.log("\n=== 2. Generate PMax-ready variants ===");
let count = 0;
for (const s of SOURCES) {
  const src = path.join(IMPORTED, s.localName);
  const base = s.localName.replace(/\.[^.]+$/, "");

  // 1:1 square (1200×1200) — best from square sources, croppable from banners
  const sq = path.join(ADS, `${base}-1x1.jpg`);
  fitCenterCrop(src, sq, 1200, 1200);
  count++;

  // 1.91:1 marketing (1200×628) — best from banner sources, croppable from squares
  const ml = path.join(ADS, `${base}-191x100.jpg`);
  fitCenterCrop(src, ml, 1200, 628);
  count++;

  // 4:5 portrait (960×1200) — needed for Discover / YouTube Shorts
  const pt = path.join(ADS, `${base}-4x5.jpg`);
  fitCenterCrop(src, pt, 960, 1200);
  count++;
}

console.log(`  generated ${count} ad-ready files in public/ads/`);
console.log("\n=== Done ===");
if (!DRY) {
  const list = fs.readdirSync(ADS).sort();
  console.log(`public/ads/ now has ${list.length} files`);
  for (const f of list.slice(0, 6)) console.log(`  - public/ads/${f}`);
  if (list.length > 6) console.log(`  ... +${list.length - 6} more`);
}
console.log(`\nNext: upload these into Google Ads → Asset Group → Images by ratio.`);
