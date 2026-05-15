import fs from "fs";
import path from "path";
import Image from "next/image";

// Internal review surface for everything currently feeding the PMax campaign
// (Sienovo Asset Group 1). Pulls from the on-disk artefacts so it stays
// accurate even when the Google Ads API is unreachable:
//   - data/google-ads-reports/YYYY-MM-DD.json  — campaign metrics
//   - data/google-ads-reports/pmax-audit-*.json — asset coverage gaps
//   - public/ads/*.{jpg,png}                   — uploaded creative

export const dynamic = "force-dynamic";

interface CampaignReport {
  date: string;
  campaign: {
    id: string;
    name: string;
    status: string;
    bidding: string;
    budgetUsd: string;
  };
  metrics: {
    impressions: number;
    clicks: number;
    costUsd: number;
    conversions: number;
    ctr: number;
    avgCpcUsd: number;
    convRate: number;
    costPerConvUsd: number;
  };
  recommendations: string[];
}

interface AuditReport {
  date: string;
  assetGroups: number;
  gaps: { assetGroup: string; field: string; have: number; want: number; label: string }[];
  recommendations: string[];
}

const SITELINKS = [
  { text: "INT-AIBOX-P-8", d1: "8-CH edge AI, 7.2 TOPS", d2: "From $1,299", url: "/products/int-aibox-p-8" },
  { text: "INT-AIBOX-RK-4", d1: "RK3588 NPU, 4-CH fanless", d2: "Entry-level $699", url: "/products/int-aibox-rk-4" },
  { text: "Edge AI Server", d1: "192 TOPS, 1U rack", d2: "SE10-U0 enterprise", url: "/products/se10-u0" },
  { text: "IoT Gateway", d1: "RK3588, 4G/5G + 4xRJ45", d2: "XM3588-GW01 $549", url: "/products/xm3588-gw01" },
  { text: "Marine IoT", d1: "Vessel tracking telemetry", d2: "Bait boat / patrol fleet", url: "/products/marine-system" },
  { text: "Technical Blog", d1: "1300+ engineering articles", d2: "RK3588 / Jetson / edge AI", url: "/blog" },
];

function loadLatest<T>(prefix: string): T | null {
  try {
    const dir = path.join(process.cwd(), "data/google-ads-reports");
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).sort();
    if (files.length === 0) return null;
    return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf-8")) as T;
  } catch {
    return null;
  }
}

function bannerGroups() {
  const dir = path.join(process.cwd(), "public/ads");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^banner-\d+/.test(f)) : [];
  const groups = new Map<string, { sizes: { aspect: string; file: string }[] }>();
  for (const f of files) {
    const m = f.match(/^banner-(\d+)-(\d+x\d+|\d+x\d+)\.jpg$/);
    if (!m) continue;
    const id = m[1];
    const aspect = m[2];
    if (!groups.has(id)) groups.set(id, { sizes: [] });
    groups.get(id)!.sizes.push({ aspect, file: f });
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, v]) => ({ id, sizes: v.sizes }));
}

function logoFiles() {
  const dir = path.join(process.cwd(), "public/ads");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^logo-/.test(f));
}

const ASPECT_LABEL: Record<string, { label: string; box: string }> = {
  "191x100": { label: "1.91:1 (Marketing)", box: "aspect-[1.91/1]" },
  "1x1": { label: "1:1 (Square)", box: "aspect-square" },
  "4x5": { label: "4:5 (Portrait)", box: "aspect-[4/5]" },
};

export default async function AdsAssetsPage() {
  const campaign = loadLatest<CampaignReport>("2026-");
  const audit = loadLatest<AuditReport>("pmax-audit-");
  const banners = bannerGroups();
  const logos = logoFiles();

  const fmtUsd = (n: number) => "$" + n.toFixed(2);
  const fmtPct = (n: number) => (n * 100).toFixed(1) + "%";

  return (
    <main className="px-6 py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ad assets</h1>
        <p className="mt-2 text-sm text-gray-500">
          Performance Max campaign · live snapshot of the creatives, sitelinks, and audit gaps feeding Google Ads.
        </p>
      </header>

      {/* ── Campaign overview ──────────────────────────────────────────── */}
      {campaign && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Campaign</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Name" value={campaign.campaign.name} />
            <Stat label="Status" value={campaign.campaign.status} accent={campaign.campaign.status === "ENABLED" ? "text-green-600" : "text-amber-600"} />
            <Stat label="Bidding" value={campaign.campaign.bidding.replace("MAXIMIZE_", "Max. ")} />
            <Stat label="Budget" value={"$" + campaign.campaign.budgetUsd + "/day"} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
            <Stat label="Impressions (30d)" value={campaign.metrics.impressions.toLocaleString()} />
            <Stat label="Clicks (30d)" value={campaign.metrics.clicks.toLocaleString()} />
            <Stat label="Cost (30d)" value={fmtUsd(campaign.metrics.costUsd)} />
            <Stat label="Conversions" value={campaign.metrics.conversions.toString()} accent={campaign.metrics.conversions === 0 ? "text-red-600" : "text-green-600"} />
            <Stat label="CTR" value={fmtPct(campaign.metrics.ctr)} />
            <Stat label="Avg CPC" value={fmtUsd(campaign.metrics.avgCpcUsd)} />
            <Stat label="Conv rate" value={fmtPct(campaign.metrics.convRate)} />
            <Stat label="Cost / conv" value={fmtUsd(campaign.metrics.costPerConvUsd)} />
          </div>
          {campaign.recommendations.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {campaign.recommendations.map((r, i) => (
                <li key={i} className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">{r}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Audit coverage gaps ────────────────────────────────────────── */}
      {audit && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Asset coverage gaps</h2>
          {audit.gaps.length === 0 ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">No coverage gaps — all required assets present.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {audit.gaps.map((g, i) => (
                <li key={i} className="flex items-center justify-between border border-gray-100 rounded px-3 py-2">
                  <span className="text-gray-700">{g.label}</span>
                  <span className={g.have === 0 ? "text-red-600 font-medium" : "text-amber-600"}>{g.have}/{g.want}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Sitelinks ──────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">Sitelinks (account level)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SITELINKS.map((s) => (
            <a key={s.text} href={s.url} target="_blank" rel="noopener" className="block border border-gray-200 rounded-lg p-4 hover:border-accent hover:shadow transition-all">
              <div className="text-blue-600 font-semibold underline">{s.text}</div>
              <div className="text-gray-700 text-sm mt-1">{s.d1}</div>
              <div className="text-gray-500 text-sm">{s.d2}</div>
              <div className="text-gray-400 text-xs mt-2 font-mono">{s.url}</div>
            </a>
          ))}
        </div>
      </section>

      {/* ── Logos ──────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">Brand identity logos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {logos.map((f) => {
            const isLandscape = /landscape/.test(f);
            return (
              <figure key={f} className={`border border-gray-200 rounded-lg p-4 ${isLandscape ? "" : "max-w-xs"}`}>
                <div className={`relative bg-gray-50 ${isLandscape ? "aspect-[4/1]" : "aspect-square"}`}>
                  <Image src={`/ads/${f}`} alt={f} fill className="object-contain" />
                </div>
                <figcaption className="text-xs text-gray-500 mt-2 font-mono">{f}</figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      {/* ── Banner gallery ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Banner assets ({banners.length} sets)</h2>
          <p className="text-xs text-gray-500">Click any banner to inspect; flag the ones with Chinese copy for regeneration.</p>
        </div>
        <div className="space-y-8">
          {banners.map((bg) => (
            <div key={bg.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">Banner #{bg.id}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                {bg.sizes.sort((a, b) => a.aspect.localeCompare(b.aspect)).map((s) => (
                  <a key={s.file} href={`/ads/${s.file}`} target="_blank" rel="noopener" className="block">
                    <div className={`relative bg-gray-100 ${ASPECT_LABEL[s.aspect]?.box || "aspect-square"} rounded overflow-hidden border border-gray-100`}>
                      <Image src={`/ads/${s.file}`} alt={s.file} fill className="object-cover" />
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex justify-between font-mono">
                      <span>{ASPECT_LABEL[s.aspect]?.label || s.aspect}</span>
                      <span>{s.file}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="border border-gray-100 rounded px-3 py-2 bg-white">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold ${accent || "text-gray-900"}`}>{value}</div>
    </div>
  );
}
