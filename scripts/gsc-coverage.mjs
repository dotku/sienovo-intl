// Inspect a sample of sitemap URLs to see indexing status.
// At this early stage, "is Google indexing us?" is more important than CTR.
//
// Run: GOOGLE_APPLICATION_CREDENTIALS=~/.gcp-keys/autoclaw-analytics-sa.json node scripts/gsc-coverage.mjs

import { google } from "googleapis";
import fs from "node:fs";

const SITE_URL = "https://intl.sienovo.cn";
const SITE_URL_NORMALIZED = `${SITE_URL}/`; // GSC URL-prefix property always uses trailing slash

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
});
const sc = google.searchconsole({ version: "v1", auth });

// 1. Sitemap status
console.log("=== Sitemap status ===");
try {
  const { data } = await sc.sitemaps.list({ siteUrl: SITE_URL_NORMALIZED });
  for (const s of data.sitemap || []) {
    console.log(`  ${s.path}`);
    console.log(`    type:           ${s.type}`);
    console.log(`    lastSubmitted:  ${s.lastSubmitted || "—"}`);
    console.log(`    lastDownloaded: ${s.lastDownloaded || "—"}`);
    console.log(`    isPending:      ${s.isPending}`);
    console.log(`    errors:         ${s.errors || 0}, warnings: ${s.warnings || 0}`);
    console.log(`    contents:       ${JSON.stringify(s.contents || [])}`);
  }
} catch (e) {
  console.error("  ✗", e.message);
}

// 2. Pull our sitemap URLs to sample
console.log("\n=== Indexing-status sample ===");
const xml = await fetch(`${SITE_URL}/sitemap.xml`).then((r) => r.text());
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`  sitemap has ${urls.length} URLs`);

// Sample: homepage, /blog, /zh/blog, plus 8 random blog posts
const sample = [
  `${SITE_URL}/`,
  `${SITE_URL}/blog`,
  `${SITE_URL}/zh/blog`,
];
const blogUrls = urls.filter((u) => /\/blog\//.test(u) && !u.endsWith("/blog"));
for (let i = 0; i < Math.min(8, blogUrls.length); i++) {
  const idx = Math.floor((blogUrls.length / 8) * i);
  sample.push(blogUrls[idx]);
}

const buckets = { PASS: 0, NEUTRAL: 0, FAIL: 0, UNKNOWN: 0 };
const verdicts = [];
console.log(`  inspecting ${sample.length} URLs (slow — 1 req each)...\n`);

for (const u of sample) {
  try {
    const { data } = await sc.urlInspection.index.inspect({
      requestBody: { inspectionUrl: u, siteUrl: SITE_URL_NORMALIZED },
    });
    const r = data.inspectionResult?.indexStatusResult || {};
    const verdict = r.verdict || "UNKNOWN";
    const cov = r.coverageState || "?";
    buckets[verdict] = (buckets[verdict] ?? 0) + 1;
    verdicts.push({ url: u, verdict, coverageState: cov, lastCrawlTime: r.lastCrawlTime, googleCanonical: r.googleCanonical });
    const mark = verdict === "PASS" ? "✅" : verdict === "NEUTRAL" ? "🟡" : "❌";
    console.log(`  ${mark} ${verdict.padEnd(8)} ${cov.slice(0, 28).padEnd(30)} ${u.replace(SITE_URL, "")}`);
  } catch (e) {
    console.log(`  ⚠ inspect failed: ${u.replace(SITE_URL, "")} — ${e.message}`);
    buckets.UNKNOWN++;
  }
}

console.log("\n=== Summary ===");
console.log(`  Indexed (PASS):       ${buckets.PASS}`);
console.log(`  Excluded (NEUTRAL):   ${buckets.NEUTRAL}`);
console.log(`  Failed (FAIL):        ${buckets.FAIL}`);
console.log(`  Unknown:              ${buckets.UNKNOWN}`);

const indexedPct = Math.round((buckets.PASS / sample.length) * 100);
console.log(`\n  ⇒ ~${indexedPct}% of sampled URLs are indexed`);
console.log(`  ⇒ extrapolated: ${Math.round((urls.length * buckets.PASS) / sample.length)} / ${urls.length} site URLs likely indexed`);

// Save raw
fs.mkdirSync("data/seo-reports", { recursive: true });
const date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  `data/seo-reports/coverage-${date}.json`,
  JSON.stringify({ date, sampleSize: sample.length, totalUrls: urls.length, buckets, verdicts }, null, 2),
);
console.log(`\n✓ wrote data/seo-reports/coverage-${date}.json`);
