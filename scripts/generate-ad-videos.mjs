#!/usr/bin/env node
/**
 * Generate slideshow ad videos from the processed ad images in public/ads/.
 * Outputs MP4 files ready to upload to YouTube → use in PMax asset group.
 *
 * Three variants:
 *   - sienovo-square.mp4    1080×1080, 15s   (in-stream / feed / Discover)
 *   - sienovo-vertical.mp4  1080×1920, 15s   (Shorts)
 *   - sienovo-landscape.mp4 1920×1080, 15s   (in-stream pre-roll)
 *
 * Requires ffmpeg. On macOS: `brew install ffmpeg`. On Linux:
 * `apt-get install -y ffmpeg fonts-noto-cjk` for CJK text support.
 *
 * Usage:
 *   node scripts/generate-ad-videos.mjs                # build all 3
 *   node scripts/generate-ad-videos.mjs --orient sq    # only square
 *   node scripts/generate-ad-videos.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const ADS = path.join(ROOT, "public/ads");
const OUT = path.join(ROOT, "public/ads/videos");
const DRY = process.argv.includes("--dry-run");
const ONLY = process.argv.includes("--orient")
  ? process.argv[process.argv.indexOf("--orient") + 1]
  : null;

fs.mkdirSync(OUT, { recursive: true });

const sh = (cmd) => {
  if (DRY) { console.log(`  [DRY] ${cmd.replace(/\n/g, " ")}`); return; }
  execSync(cmd, { stdio: ["ignore", "inherit", "inherit"], shell: "/bin/bash" });
};

// Pick a font that supports CJK. Cross-platform fallback chain.
function findFont() {
  const candidates = [
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",   // Linux Noto CJK
    "/System/Library/Fonts/PingFang.ttc",                       // macOS Chinese
    "/System/Library/Fonts/HelveticaNeue.ttc",                  // macOS fallback
    "/System/Library/Fonts/Helvetica.ttc",
  ];
  for (const f of candidates) if (fs.existsSync(f)) return f;
  return null;
}
const FONT = findFont();

// Slide config: { image-suffix, headline, sub }
const SLIDES = [
  { img: "sq-01-1x1.jpg", headline: "Edge AI Computing",        sub: "8-ch · 12 TOPS · fanless" },
  { img: "sq-02-1x1.jpg", headline: "40+ Built-in AI Algorithms", sub: "Detect · Recognize · Alert" },
  { img: "banner-04-1x1.jpg", headline: "Industrial Reliability",   sub: "-20°C to 60°C · 7×24" },
  { img: "sq-03-1x1.jpg", headline: "Customizable Solutions",   sub: "ARM + FPGA + AI" },
  { img: "banner-07-1x1.jpg", headline: "Sienovo · 深圳信迈",   sub: "intl.sienovo.cn" },
];

const SLIDE_SEC = 3.0;
const XFADE_SEC = 0.5;
const TOTAL = SLIDES.length * SLIDE_SEC - (SLIDES.length - 1) * XFADE_SEC;

function buildFilter(targetW, targetH) {
  // For each slide: scale-and-pad to target size, then drawtext (white text +
  // semi-transparent black bar at bottom), then xfade-chain them.
  const escape = (s) => s.replace(/'/g, "\\'").replace(/:/g, "\\:");
  const sub = (i) => {
    const t = SLIDES[i];
    const fontPart = FONT ? `:fontfile='${FONT}'` : "";
    return [
      // scale longest dim to fit, then pad to exact target with black bars
      `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1`,
      // headline (large, ~6% of height from bottom-ish)
      `drawtext=text='${escape(t.headline)}'${fontPart}:fontcolor=white:fontsize=${Math.round(targetH * 0.07)}:box=1:boxcolor=0x000000@0.55:boxborderw=24:x=(w-text_w)/2:y=h-text_h-${Math.round(targetH * 0.18)}`,
      // subtitle (smaller, below)
      `drawtext=text='${escape(t.sub)}'${fontPart}:fontcolor=0xfde68a:fontsize=${Math.round(targetH * 0.04)}:box=1:boxcolor=0x000000@0.55:boxborderw=16:x=(w-text_w)/2:y=h-text_h-${Math.round(targetH * 0.10)}`,
      `format=yuv420p[v${i}]`,
    ].join(",");
  };
  const chains = SLIDES.map((_, i) => sub(i)).join(";");

  // xfade chain
  let xfade = "";
  let prev = "v0";
  for (let i = 1; i < SLIDES.length; i++) {
    const offset = i * SLIDE_SEC - i * XFADE_SEC;
    const tag = i === SLIDES.length - 1 ? "out" : `x${i}`;
    xfade += `;[${prev}][v${i}]xfade=transition=fade:duration=${XFADE_SEC}:offset=${offset.toFixed(2)}[${tag}]`;
    prev = tag;
  }
  return `${chains}${xfade}`;
}

function renderVariant(name, targetW, targetH) {
  const out = path.join(OUT, name);
  console.log(`\n→ ${name}  (${targetW}×${targetH}, ${TOTAL}s)`);
  const inputs = SLIDES.map((s) => `-loop 1 -t ${SLIDE_SEC} -i "${path.join(ADS, s.img)}"`).join(" ");
  const filter = buildFilter(targetW, targetH);
  const cmd = `ffmpeg -y ${inputs} -filter_complex "${filter}" -map "[out]" -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart -t ${TOTAL} "${out}"`;
  sh(cmd);
  if (!DRY && fs.existsSync(out)) {
    const kb = (fs.statSync(out).size / 1024).toFixed(0);
    console.log(`  ✓ ${out.replace(ROOT + "/", "")}  (${kb} KB)`);
  }
}

console.log(`Font:    ${FONT || "(none — will use ffmpeg default, may not render CJK)"}`);
console.log(`Slides:  ${SLIDES.length} @ ${SLIDE_SEC}s + ${XFADE_SEC}s xfade = ${TOTAL}s total`);

const variants = [
  ["sienovo-square.mp4",    1080, 1080, "sq"],
  ["sienovo-vertical.mp4",  1080, 1920, "vert"],
  ["sienovo-landscape.mp4", 1920, 1080, "land"],
];
for (const [name, w, h, key] of variants) {
  if (ONLY && ONLY !== key) continue;
  // Verify source images exist
  for (const s of SLIDES) {
    if (!fs.existsSync(path.join(ADS, s.img))) {
      console.error(`  ✗ source missing: ${s.img} — run scripts/sync-ads-assets.mjs first`);
      process.exit(1);
    }
  }
  renderVariant(name, w, h);
}

if (!DRY) console.log(`\n✓ output dir: ${OUT}\nUpload to YouTube (unlisted is fine), then attach in PMax → Asset Group.`);
