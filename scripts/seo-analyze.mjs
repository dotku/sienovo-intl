// Compare today's snapshots against 7-day and 28-day baselines, then write
// today's actionable recommendations to data/seo-reports/analysis-YYYY-MM-DD.md.
//
// Pure local analysis — no API calls. Run after gsc-pull.mjs + gsc-coverage.mjs.

import fs from "node:fs";
import path from "node:path";

const DIR = "data/seo-reports";
fs.mkdirSync(DIR, { recursive: true });
const files = fs.readdirSync(DIR);
const today = new Date().toISOString().slice(0, 10);

// Load latest daily snapshot
const dailySnaps = files
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();
const coverageSnaps = files
  .filter((f) => /^coverage-\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

if (!dailySnaps.length || !coverageSnaps.length) {
  console.log("not enough snapshots yet — run gsc-pull + gsc-coverage first");
  process.exit(0);
}

const latest = JSON.parse(
  fs.readFileSync(path.join(DIR, dailySnaps[dailySnaps.length - 1]), "utf8"),
);
const latestCov = JSON.parse(
  fs.readFileSync(path.join(DIR, coverageSnaps[coverageSnaps.length - 1]), "utf8"),
);

// Baselines: 7 days ago + 28 days ago (closest snapshot before)
const cutoff = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
};
const findClosest = (snapList, beforeDate) => {
  const candidates = snapList.filter((f) => f.localeCompare(beforeDate) <= 0);
  return candidates[candidates.length - 1];
};
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

const week = findClosest(dailySnaps, cutoff(7));
const month = findClosest(dailySnaps, cutoff(28));
const weekCov = findClosest(coverageSnaps, cutoff(7));
const monthCov = findClosest(coverageSnaps, cutoff(28));

const delta = (now, then) =>
  then ? now - then : null;
const pctDelta = (now, then) =>
  then && then !== 0 ? (((now - then) / then) * 100).toFixed(1) : null;

const fmt = (n) => (n == null ? "n/a" : n > 0 ? `+${n}` : `${n}`);
const fmtPct = (n) => (n == null ? "n/a" : `${n > 0 ? "+" : ""}${n}%`);

// === Build analysis ===
const recs = [];

// 1. Indexing growth rate
const indexedNow = latestCov.buckets.PASS;
const indexedWeek = weekCov ? load(weekCov).buckets.PASS : null;
const indexedMonth = monthCov ? load(monthCov).buckets.PASS : null;
const extrapNow = Math.round(
  (latestCov.totalUrls * latestCov.buckets.PASS) / latestCov.sampleSize,
);

if (indexedWeek != null && indexedNow - indexedWeek === 0) {
  recs.push({
    priority: "P0",
    title: "Indexing has stalled for a week",
    detail:
      `Indexed URL count hasn't changed in 7 days (${indexedNow}/${latestCov.sampleSize}). ` +
      `Likely causes: (a) hub page doesn't link enough articles → fix internal linking; ` +
      `(b) low domain authority → build backlinks; (c) thin content noindexed → check isLowQualityPost threshold. ` +
      `Action: manually Request Indexing for top 3 articles in GSC.`,
  });
} else if (indexedWeek != null && indexedNow - indexedWeek > 0) {
  recs.push({
    priority: "OK",
    title: `Indexing is growing — ${indexedNow - indexedWeek} new URL(s) in 7d`,
    detail: `Healthy crawl progress. ${indexedNow}/${latestCov.sampleSize} sample URLs indexed (extrapolated ~${extrapNow}/${latestCov.totalUrls}).`,
  });
}

// 2. Traffic growth
const impWeek = week ? load(week).overall.impressions : null;
const impMonth = month ? load(month).overall.impressions : null;
const impNow = latest.overall.impressions;

if (impWeek != null && impWeek > 0 && impNow / impWeek > 1.5) {
  recs.push({
    priority: "OK",
    title: `Impressions up ${pctDelta(impNow, impWeek)}% week-over-week`,
    detail: `${impWeek} → ${impNow}. Keep doing whatever you're doing.`,
  });
} else if (impWeek != null && impWeek > 0 && impNow / impWeek < 0.7) {
  recs.push({
    priority: "P1",
    title: `Impressions DOWN ${pctDelta(impNow, impWeek)}% week-over-week`,
    detail: `${impWeek} → ${impNow}. Check if a high-traffic page got deindexed, or a sitemap regression happened.`,
  });
}

// 3. Low-CTR pages (rank top 20, CTR < 1%, imp >= 20)
const lowCtr = (latest.byPage || []).filter(
  (r) => r.position < 21 && r.impressions >= 20 && r.ctr < 0.01,
);
if (lowCtr.length > 0) {
  recs.push({
    priority: "P1",
    title: `${lowCtr.length} page(s) rank top-20 but get clicked < 1%`,
    detail:
      "Highest-ROI SEO fix. Likely cause: generic or non-compelling page <title>/<meta description>. " +
      "Action: rewrite titles to include the keyword users are searching + a hook.",
    items: lowCtr
      .slice(0, 5)
      .map(
        (r) =>
          `\`${r.keys[0].replace("https://sienovo.jytech.us", "")}\` — ${r.impressions} imp, pos ${r.position.toFixed(1)}, CTR ${(r.ctr * 100).toFixed(2)}%`,
      ),
  });
}

// 4. Near-top queries (pos 11-20, imp >= 10)
const nearTop = (latest.byQuery || []).filter(
  (r) => r.position > 10 && r.position < 21 && r.impressions >= 10,
);
if (nearTop.length > 0) {
  recs.push({
    priority: "P1",
    title: `${nearTop.length} quer(ies) are one rank from page 1`,
    detail:
      "Each ranks 11-20 with real impressions — small content improvements could push them to top 10.",
    items: nearTop
      .slice(0, 5)
      .map(
        (r) =>
          `"${r.keys[0]}" — ${r.impressions} imp, pos ${r.position.toFixed(1)}`,
      ),
  });
}

// 5. Cold-start guidance (no traffic yet)
if (impNow < 50) {
  recs.push({
    priority: "P2",
    title: "Site is still in cold-start phase",
    detail:
      "With <50 impressions, GSC data is too sparse for query/CTR optimization. Focus on:" +
      "\n- Manually Request Indexing for top 5 articles in GSC (10/day quota)" +
      "\n- Build backlinks: share on LinkedIn / X / Hacker News / industry forums" +
      "\n- Add internal links from /blog/all to deep article tags/categories" +
      "\n- Verify Google can reach `/blog/all` (it's the highest-density hub page)",
  });
}

// === Write markdown ===
const fmtDelta = (now, then) => {
  if (then == null) return "(no baseline)";
  const d = delta(now, then);
  if (d == null) return "?";
  return `${then} → ${now} (${fmt(d)})`;
};

const md = `# SEO daily analysis · ${today}

## Quick numbers

| Metric | Now | 7 days ago | 28 days ago |
|---|---:|---:|---:|
| Clicks | ${impNow > 0 ? latest.overall.clicks : 0} | ${week ? load(week).overall.clicks : "—"} | ${month ? load(month).overall.clicks : "—"} |
| Impressions | ${impNow} | ${impWeek ?? "—"} | ${impMonth ?? "—"} |
| Indexed (sample) | ${indexedNow}/${latestCov.sampleSize} | ${indexedWeek ?? "—"}/${latestCov.sampleSize} | ${indexedMonth ?? "—"}/${latestCov.sampleSize} |
| Indexed extrapolated | ~${extrapNow}/${latestCov.totalUrls} | — | — |

## 🎯 Today's recommendations

${recs.length === 0 ? "_No actionable signals yet — keep collecting daily snapshots._" : recs
  .sort((a, b) =>
    a.priority === "OK" ? 1 : b.priority === "OK" ? -1 : a.priority.localeCompare(b.priority),
  )
  .map(
    (r) =>
      `### ${r.priority === "OK" ? "✅" : r.priority === "P0" ? "🔴" : r.priority === "P1" ? "🟡" : "⚪"} ${r.priority} — ${r.title}\n\n${r.detail}${r.items ? "\n\n" + r.items.map((x) => `- ${x}`).join("\n") : ""}`,
  )
  .join("\n\n")}

---
_Auto-generated by \`scripts/seo-analyze.mjs\`. Trend index: [TREND.md](./TREND.md)_
`;

fs.writeFileSync(path.join(DIR, `analysis-${today}.md`), md);
console.log(`✓ wrote ${DIR}/analysis-${today}.md`);
console.log(`  ${recs.length} recommendations`);
