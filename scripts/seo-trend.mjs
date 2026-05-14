// Walk data/seo-reports/ and produce a single trend table from all daily
// snapshots. Idempotent — re-running just rewrites the index from disk.

import fs from "node:fs";
import path from "node:path";

const DIR = "data/seo-reports";
fs.mkdirSync(DIR, { recursive: true });
const files = fs.readdirSync(DIR);

// Daily search-analytics files (gsc-pull): YYYY-MM-DD.json
const dailySnaps = files
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    return {
      date: f.replace(".json", ""),
      clicks: d.overall.clicks,
      impressions: d.overall.impressions,
      ctr: d.overall.ctr,
      pagesWithTraffic: d.byPage?.length || 0,
    };
  });

// Coverage files (gsc-coverage): coverage-YYYY-MM-DD.json
const coverageSnaps = files
  .filter((f) => /^coverage-\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    return {
      date: f.replace("coverage-", "").replace(".json", ""),
      sampleSize: d.sampleSize,
      totalUrls: d.totalUrls,
      indexed: d.buckets.PASS,
      excluded: d.buckets.NEUTRAL,
      indexedPct: d.sampleSize ? Math.round((d.buckets.PASS / d.sampleSize) * 100) : 0,
      extrapolated: d.sampleSize
        ? Math.round((d.totalUrls * d.buckets.PASS) / d.sampleSize)
        : 0,
    };
  });

const md = `# SEO trend (auto-generated, do not edit)

_Latest update: ${new Date().toISOString()}_

## Daily search analytics (28-day rolling window per row)

| Date | Clicks | Impressions | CTR | Pages w/ traffic |
|---|---:|---:|---:|---:|
${dailySnaps
  .map(
    (s) =>
      `| ${s.date} | ${s.clicks} | ${s.impressions} | ${(s.ctr * 100).toFixed(2)}% | ${s.pagesWithTraffic} |`,
  )
  .join("\n")}

## Indexing coverage trend

| Date | Sample indexed | % | Extrapolated (of ${coverageSnaps[coverageSnaps.length - 1]?.totalUrls ?? "?"}) |
|---|---:|---:|---:|
${coverageSnaps
  .map(
    (s) => `| ${s.date} | ${s.indexed}/${s.sampleSize} | ${s.indexedPct}% | ~${s.extrapolated} |`,
  )
  .join("\n")}

---
${dailySnaps.length} daily snapshots · ${coverageSnaps.length} coverage snapshots
`;

fs.writeFileSync(path.join(DIR, "TREND.md"), md);
console.log(`✓ wrote ${DIR}/TREND.md`);
console.log(`  ${dailySnaps.length} daily snapshots, ${coverageSnaps.length} coverage snapshots`);
