#!/usr/bin/env node

/**
 * Compose English-only PMax banner ads from clean product hero photos in
 * public/images/pptx/. The existing public/ads/banner-*.jpg images are
 * Chinese-text PCB datasheet crops — fine for the CN market but bad for
 * the US-targeted Sienovo campaign. This script outputs Sienovo-branded
 * banners with English copy, sized to fill the PMax coverage gaps:
 *
 *   Marketing (1.91:1) 1200×628  — fills "Marketing images" slot
 *   Square    (1:1)    1200×1200 — fills "Square images" slot
 *   Portrait  (4:5)    960×1200  — fills "Portrait images" slot
 *
 * Currently writes one set per product to public/ads/sienovo-en-{slug}-{aspect}.jpg.
 *
 * Usage: node scripts/generate-pmax-banners.mjs
 */

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "public/ads");
mkdirSync(OUT, { recursive: true });

const ICON_SVG = readFileSync(join(ROOT, "src/app/icon.svg"));

// Each entry produces 3 banner files (1.91:1, 1:1, 4:5).
const BANNERS = [
  {
    slug: "int-aibox-p-8",
    hero: "public/images/pptx/aibox-sg8.png",
    headline: "Edge AI Computing",
    subhead: "8-channel · 7.2 TOPS · Fanless",
    badge: "INT-AIBOX-P-8",
  },
  {
    slug: "int-aibox-lineup",
    hero: "public/images/pptx/aibox-lineup.png",
    headline: "Industrial Edge AI",
    subhead: "40+ pre-loaded CV algorithms",
    badge: "Sienovo INT-AIBOX",
  },
  {
    slug: "int-aibox-sg16",
    hero: "public/images/pptx/aibox-sg16.png",
    headline: "16-Channel Edge AI",
    subhead: "12 TOPS · Industrial reliability",
    badge: "INT-AIBOX-P-16",
  },
  {
    slug: "industrial-video-analytics",
    hero: "public/images/pptx/aibox-intro.png",
    headline: "Industrial Video AI",
    subhead: "PPE · Smoke · Intrusion · 40+ algos",
    badge: "Sienovo Edge AI",
  },
  {
    slug: "fanless-rugged",
    hero: "public/images/pptx/aibox-features.png",
    headline: "Fanless. Rugged. Ready.",
    subhead: "–20°C to +60°C · IP41 · MIL-grade",
    badge: "Sienovo INT-AIBOX",
  },
];

const RATIOS = [
  { name: "191x100", w: 1200, h: 628, layout: "horizontal" },
  { name: "1x1", w: 1200, h: 1200, layout: "vertical" },
  { name: "4x5", w: 960, h: 1200, layout: "vertical" },
];

const ACCENT = "#dd3232"; // brand red
const TEXT = "#1a1a1a";
const SUBTEXT = "#525252";
const BG_LIGHT = "#f5f5f5";
const BG_WHITE = "#ffffff";

function brandHeader(w, padX = 32, padY = 32) {
  // Small Sienovo wordmark in the top-left corner of every banner.
  return Buffer.from(`
<svg width="${w}" height="100" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${padX}, ${padY})">
    <rect width="44" height="44" rx="8" fill="${ACCENT}"/>
    <text x="22" y="33" text-anchor="middle"
          font-family="-apple-system, system-ui, sans-serif"
          font-weight="700" font-size="28" fill="white" letter-spacing="-1">S</text>
    <text x="56" y="32" font-family="-apple-system, system-ui, sans-serif"
          font-weight="700" font-size="26" fill="${TEXT}" letter-spacing="-1">Sienovo</text>
  </g>
</svg>
`);
}

function horizontalText({ w, h, headline, subhead, badge }) {
  // Right half: text. Left half: product image.
  const textX = w / 2 + 30;
  const textBoxW = w / 2 - 60;
  return Buffer.from(`
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${BG_LIGHT}"/>
      <stop offset="100%" stop-color="${BG_WHITE}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g transform="translate(${textX}, 0)">
    <text y="${h * 0.30}" font-family="-apple-system, system-ui, sans-serif"
          font-weight="700" font-size="${Math.min(64, textBoxW * 0.13)}" fill="${TEXT}"
          letter-spacing="-2">${headline}</text>
    <text y="${h * 0.30 + Math.min(64, textBoxW * 0.13) * 0.95}"
          font-family="-apple-system, system-ui, sans-serif"
          font-weight="400" font-size="${Math.min(28, textBoxW * 0.055)}" fill="${SUBTEXT}">
      ${subhead}
    </text>
    <g transform="translate(0, ${h * 0.30 + Math.min(64, textBoxW * 0.13) * 1.6})">
      <rect width="${badge.length * 12 + 30}" height="40" rx="20" fill="${ACCENT}"/>
      <text x="${(badge.length * 12 + 30) / 2}" y="27" text-anchor="middle"
            font-family="-apple-system, system-ui, sans-serif"
            font-weight="600" font-size="16" fill="white" letter-spacing="0.5">${badge}</text>
    </g>
  </g>
</svg>
`);
}

function verticalText({ w, h, headline, subhead, badge }) {
  // Bottom third: text. Top two-thirds: product image.
  const textY = h * 0.62;
  return Buffer.from(`
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${BG_WHITE}"/>
      <stop offset="100%" stop-color="${BG_LIGHT}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g transform="translate(${w * 0.06}, ${textY})">
    <text y="0" font-family="-apple-system, system-ui, sans-serif"
          font-weight="700" font-size="${Math.min(56, w * 0.055)}" fill="${TEXT}"
          letter-spacing="-2">${headline}</text>
    <text y="${Math.min(56, w * 0.055) + 14}"
          font-family="-apple-system, system-ui, sans-serif"
          font-weight="400" font-size="${Math.min(26, w * 0.027)}" fill="${SUBTEXT}">
      ${subhead}
    </text>
    <g transform="translate(0, ${Math.min(56, w * 0.055) + 60})">
      <rect width="${badge.length * 12 + 30}" height="40" rx="20" fill="${ACCENT}"/>
      <text x="${(badge.length * 12 + 30) / 2}" y="27" text-anchor="middle"
            font-family="-apple-system, system-ui, sans-serif"
            font-weight="600" font-size="16" fill="white" letter-spacing="0.5">${badge}</text>
    </g>
  </g>
</svg>
`);
}

async function compose(banner, ratio) {
  const heroBuf = readFileSync(join(ROOT, banner.hero));

  // Where the product image lives in the layout.
  let productW, productH, productX, productY;
  if (ratio.layout === "horizontal") {
    productW = Math.round(ratio.w * 0.50);
    productH = ratio.h - 80;
    productX = 30;
    productY = 60;
  } else {
    productW = Math.round(ratio.w * 0.85);
    productH = Math.round(ratio.h * 0.45);
    productX = Math.round((ratio.w - productW) / 2);
    productY = Math.round(ratio.h * 0.08);
  }

  const productPng = await sharp(heroBuf)
    .resize(productW, productH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const bgSvg =
    ratio.layout === "horizontal"
      ? horizontalText({ w: ratio.w, h: ratio.h, ...banner })
      : verticalText({ w: ratio.w, h: ratio.h, ...banner });
  const header = brandHeader(ratio.w);

  const out = join(OUT, `sienovo-en-${banner.slug}-${ratio.name}.jpg`);
  await sharp(bgSvg)
    .composite([
      { input: productPng, top: productY, left: productX },
      { input: header, top: 0, left: 0 },
    ])
    .jpeg({ quality: 88 })
    .toFile(out);
  console.log(`✓ ${out}  (${ratio.w}×${ratio.h})`);
}

for (const banner of BANNERS) {
  for (const ratio of RATIOS) {
    await compose(banner, ratio);
  }
}
console.log(`\nDone. Upload to Ads → Asset Group 1 → Add images.`);
