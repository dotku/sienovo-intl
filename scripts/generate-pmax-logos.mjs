#!/usr/bin/env node

/**
 * Generate PMax brand-identity assets from the existing icon.svg so we can
 * fix the "Asset strength: AVERAGE" gate that's choking the Sienovo PMax
 * campaign. Without these three Google won't push impressions, regardless
 * of how many product photos we upload.
 *
 * Outputs (all into public/ads/):
 *   logo-square-1200.png   1200×1200    — required PMax Logo
 *   logo-landscape.png     auto-sized   — required PMax Landscape Logo,
 *                                         trimmed to actual content with
 *                                         uniform 30px white padding.
 *                                         Typical output: ~900×300.
 *
 * The "Business name" PMax field is text-only ("Sienovo"), so no file
 * needed — type it directly in the Ads UI asset group.
 *
 * Usage:
 *   node scripts/generate-pmax-logos.mjs
 */

import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC_ICON = join(ROOT, "src/app/icon.svg");
const OUT_DIR = join(ROOT, "public/ads");
mkdirSync(OUT_DIR, { recursive: true });

const iconSvg = readFileSync(SRC_ICON);

// ── 1. Square logo (1200×1200) ──────────────────────────────────────────────
// Take the icon SVG, render to 1200×1200 with sharp. That's the format
// Google's PMax Logo slot expects (square aspect, ~1200px on the long edge).
const squarePath = join(OUT_DIR, "logo-square-1200.png");
await sharp(iconSvg, { density: 600 })
  .resize(1200, 1200, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toFile(squarePath);
console.log(`✓ wrote ${squarePath}`);

// ── 2. Landscape logo (auto-sized) ──────────────────────────────────────────
// Composition: icon left (240×240) on a white canvas + "SIENOVO" text right.
// PMax allows 1.91:1 to 8:1; we render onto an oversize canvas and trim
// trailing whitespace + re-pad evenly so the final image hugs the content
// (no dead space to the right of the wordmark).
const RENDER_W = 1600;
const H = 300;
const PAD = 30;
const ICON_SIZE = H - PAD * 2; // 240
const ICON_X = PAD;
const ICON_Y = PAD;
const TEXT_X = ICON_X + ICON_SIZE + 40;
const TEXT_FONT_SIZE = 130;
const TEXT_BASELINE_Y = (H + TEXT_FONT_SIZE) / 2 - 22;

// Render the icon at the small size for the landscape composite
const iconPng = await sharp(iconSvg, { density: 600 })
  .resize(ICON_SIZE, ICON_SIZE)
  .png()
  .toBuffer();

// Build the text as an inline SVG overlay so we don't need a font file.
// All-caps wordmark + tighter tracking — heavier optical weight, no
// trailing whitespace gets baked into the composite.
const textSvg = Buffer.from(`
<svg width="${RENDER_W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .brand {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-weight: 800;
      letter-spacing: -4px;
    }
  </style>
  <text x="${TEXT_X}" y="${TEXT_BASELINE_Y}" class="brand" font-size="${TEXT_FONT_SIZE}" fill="#1a1a1a">SIENOVO</text>
</svg>
`);

const compositeBuffer = await sharp({
  create: {
    width: RENDER_W,
    height: H,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([
    { input: iconPng, top: ICON_Y, left: ICON_X },
    { input: textSvg, top: 0, left: 0 },
  ])
  .png()
  .toBuffer();

// Trim white margins on every edge, then add a uniform PAD of white back
// in. End result: ICON | gap | SIENOVO, with consistent 30px padding all
// around — and no trailing right-side whitespace.
const landscapePath = join(OUT_DIR, "logo-landscape.png");
await sharp(compositeBuffer)
  .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 5 })
  .extend({
    top: PAD,
    bottom: PAD,
    left: PAD,
    right: PAD,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .png()
  .toFile(landscapePath);
const { width: outW, height: outH } = await sharp(landscapePath).metadata();
console.log(`✓ wrote ${landscapePath} (${outW}×${outH})`);

console.log("\nNext step: upload both to Google Ads → Campaigns → Sienovo → Asset Group 1");
console.log("  Logo (square):    " + squarePath);
console.log("  Landscape logo:   " + landscapePath);
console.log('  Business name:    type "Sienovo" in the Business name field (no file)');
