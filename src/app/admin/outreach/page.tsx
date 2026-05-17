"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

interface Campaign {
  id: string;
  name: string;
  status: string;
  targetIndustries: string | null;
  targetTitles: string | null;
  createdAt: string;
  _count: { steps: number; emails: number };
  stats: { pending: number; draft: number; approved: number; sent: number; failed: number; skipped: number };
}

interface Metrics {
  lifetime: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    complaint: number;
    unsubscribed: number;
  };
  byCampaign: Array<{
    id: string;
    name: string;
    status: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  }>;
  daily: Array<{ date: string; sent: number; opened: number; replied: number }>;
  contactCount: number;
  activeCampaigns: number;
}

function pct(n: number, d: number): string {
  if (!d) return "—";
  return ((n / d) * 100).toFixed(1) + "%";
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
};

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.admin?.outreach || {};
  const tc = dict.admin?.common || {};

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/outreach/campaigns").then((r) => r.json()),
      fetch("/api/admin/outreach/metrics").then((r) => r.json()),
    ]).then(([c, m]) => {
      setCampaigns(c);
      setMetrics(m);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/outreach/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: t.newCampaign || "New Campaign" }),
    });
    if (res.ok) {
      const c = await res.json();
      router.push(`/admin/outreach/${c.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{tc.loading || "Loading..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t.campaigns || "Campaigns"}</h1>
          <div className="flex gap-3">
            <Link
              href="/admin/outreach/emails"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {t.emailQueue || "Email Queue"}
            </Link>
            <button
              onClick={handleCreate}
              className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              {t.newCampaign || "+ New Campaign"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {metrics && <MetricsDashboard metrics={metrics} />}

        {campaigns.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">{t.noCampaigns || "No campaigns yet"}</p>
            <p className="text-sm mt-1">{t.createFirst || "Create your first outreach campaign"}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{tc.name || "Name"}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t.status || "Status"}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t.targeting || "Targeting"}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">{t.steps || "Steps"}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">{t.emailStats || "Emails"}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">{t.created || "Created"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/outreach/${c.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-700"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-48 truncate">
                      {[c.targetIndustries, c.targetTitles].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{c._count.steps}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs">
                        {c.stats.sent > 0 && <span className="text-green-600">{c.stats.sent} sent</span>}
                        {c.stats.draft > 0 && <span className="text-yellow-600">{c.stats.draft} draft</span>}
                        {c.stats.pending > 0 && <span className="text-gray-400">{c.stats.pending} pending</span>}
                        {c.stats.sent === 0 && c.stats.draft === 0 && c.stats.pending === 0 && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Marketing report: funnel + per-campaign + daily volume ─────────────────
function MetricsDashboard({ metrics }: { metrics: Metrics }) {
  const { lifetime, byCampaign, daily, contactCount, activeCampaigns } = metrics;
  const maxDaily = Math.max(1, ...daily.map((d) => d.sent + d.opened + d.replied));

  const stages: Array<{ key: keyof typeof lifetime; label: string; baseline?: keyof typeof lifetime }> = [
    { key: "sent", label: "Sent" },
    { key: "delivered", label: "Delivered", baseline: "sent" },
    { key: "opened", label: "Opened", baseline: "delivered" },
    { key: "clicked", label: "Clicked", baseline: "opened" },
    { key: "replied", label: "Replied", baseline: "delivered" },
  ];

  return (
    <section className="space-y-6">
      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Active campaigns" value={activeCampaigns} />
        <KPI label="Contacts in pipeline" value={contactCount.toLocaleString()} />
        <KPI label="Total sent" value={lifetime.sent.toLocaleString()} />
        <KPI
          label="Bounces"
          value={lifetime.bounced.toLocaleString()}
          sub={pct(lifetime.bounced, lifetime.sent)}
          accent={lifetime.sent > 0 && lifetime.bounced / lifetime.sent > 0.05 ? "text-red-600" : undefined}
        />
        <KPI
          label="Complaints"
          value={lifetime.complaint.toLocaleString()}
          sub={pct(lifetime.complaint, lifetime.sent)}
          accent={lifetime.sent > 0 && lifetime.complaint / lifetime.sent > 0.001 ? "text-red-600" : undefined}
        />
      </div>

      {/* ── Funnel ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Lifetime funnel</h2>
        <div className="grid grid-cols-5 gap-2">
          {stages.map((s) => {
            const v = lifetime[s.key];
            const base = s.baseline ? lifetime[s.baseline] : 0;
            const rate = s.baseline ? pct(v, base) : null;
            const width = lifetime.sent > 0 ? (v / lifetime.sent) * 100 : 0;
            return (
              <div key={s.key}>
                <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                <div className="bg-gray-50 rounded h-12 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500/80"
                    style={{ width: `${Math.max(2, width)}%` }}
                  />
                  <div className="relative h-full flex items-center px-2 text-sm font-semibold text-gray-900">
                    {v.toLocaleString()}
                  </div>
                </div>
                {rate && <div className="text-xs text-gray-500 mt-1">{rate} of {s.baseline}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 14d daily volume ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">14-day volume</h2>
        <div className="flex items-end gap-1 h-32">
          {daily.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group">
              <div className="w-full flex flex-col-reverse" style={{ height: "100%" }}>
                <div
                  className="bg-blue-500/80 w-full"
                  style={{ height: `${(d.sent / maxDaily) * 100}%` }}
                  title={`${d.sent} sent`}
                />
                <div
                  className="bg-amber-400/80 w-full"
                  style={{ height: `${(d.opened / maxDaily) * 100}%` }}
                  title={`${d.opened} opened`}
                />
                <div
                  className="bg-green-500/80 w-full"
                  style={{ height: `${(d.replied / maxDaily) * 100}%` }}
                  title={`${d.replied} replied`}
                />
              </div>
              <div className="text-[10px] text-gray-400">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 text-xs text-gray-500 mt-3">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-500/80" /> Sent</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-400/80" /> Opened</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-500/80" /> Replied</span>
        </div>
      </div>

      {/* ── Per-campaign metrics ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 px-5 py-3 border-b border-gray-200">Per-campaign performance</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Campaign</th>
              <th className="text-right px-4 py-2 font-medium">Sent</th>
              <th className="text-right px-4 py-2 font-medium">Open rate</th>
              <th className="text-right px-4 py-2 font-medium">Click rate</th>
              <th className="text-right px-4 py-2 font-medium">Reply rate</th>
              <th className="text-right px-4 py-2 font-medium">Bounce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {byCampaign.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-2 text-right">{c.sent.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-gray-700">{pct(c.opened, c.delivered)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{pct(c.clicked, c.opened)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{pct(c.replied, c.delivered)}</td>
                <td className="px-4 py-2 text-right">
                  <span className={c.sent > 0 && c.bounced / c.sent > 0.05 ? "text-red-600 font-medium" : "text-gray-500"}>
                    {pct(c.bounced, c.sent)}
                  </span>
                </td>
              </tr>
            ))}
            {byCampaign.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">
                  No campaigns yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KPI({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent || "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
