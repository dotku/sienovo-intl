#!/usr/bin/env node

/**
 * Generate PMax brand-identity assets from the existing icon.svg so we can
 * fix the "Asset strength: AVERAGE" gate that's choking the Sienovo PMax
 * campaign. Without these three Google won't push impressions, regardless
 * of how many product photos we upload.
 *
 * Outputs (all into public/ads/):
 *   logo-square-1200.png      1200×1200 — required PMax Logo
 *   logo-landscape-1200x300.png  1200×300  — required PMax Landscape Logo
 *
 * The "Business name" PMax field is text-only ("Sienovo"), so no file
 * needed — type it directly in the Ads UI asset group.
 *
 * Usage:
 *   node scripts/generate-pmax-logos.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

// ── 2. Landscape logo (1200×300) ────────────────────────────────────────────
// Composition: icon left (240×240) on a white canvas + "Sienovo" text right.
// PMax allows 1.91:1 to 8:1 — 4:1 is the safest middle ground.
const W = 1200;
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

// Build the text as an inline SVG overlay so we don't need a font file
const textSvg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .brand {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-weight: 700;
      letter-spacing: -3px;
    }
  </style>
  <text x="${TEXT_X}" y="${TEXT_BASELINE_Y}" class="brand" font-size="${TEXT_FONT_SIZE}" fill="#1a1a1a">Sienovo</text>
</svg>
`);

const landscapePath = join(OUT_DIR, "logo-landscape-1200x300.png");
await sharp({
  create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([
    { input: iconPng, top: ICON_Y, left: ICON_X },
    { input: textSvg, top: 0, left: 0 },
  ])
  .png()
  .toFile(landscapePath);
console.log(`✓ wrote ${landscapePath}`);

console.log("\nNext step: upload both to Google Ads → Campaigns → Sienovo → Asset Group 1");
console.log("  Logo (square):    " + squarePath);
console.log("  Landscape logo:   " + landscapePath);
console.log('  Business name:    type "Sienovo" in the Business name field (no file)');
