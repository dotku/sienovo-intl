import Link from "next/link";
import { loadBotReport } from "@/lib/bot-reports";

export const dynamic = "force-dynamic";

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function fmtTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

export default async function AdminReportsPage() {
  let report;
  try {
    report = await loadBotReport();
  } catch (err) {
    console.error("[admin/reports] failed", err);
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Bot Reports
        </h1>
        <div className="rounded-lg bg-red-50 border border-red-100 p-6 text-sm text-red-700">
          Failed to load reports. Check Prisma connectivity, then refresh.
        </div>
      </main>
    );
  }

  const { outreach, blog, seo, apiUsage, date } = report;
  const bounceRate =
    outreach.sentToday + outreach.bouncedToday > 0
      ? (outreach.bouncedToday /
          (outreach.sentToday + outreach.bouncedToday)) *
        100
      : 0;
  const complaintRate =
    outreach.sentToday + outreach.complaintToday > 0
      ? (outreach.complaintToday /
          (outreach.sentToday + outreach.complaintToday)) *
        100
      : 0;
  const bounceWarn = bounceRate > 3;
  const complaintWarn = complaintRate > 0.1;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Bot Reports
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Today&apos;s automation activity across outreach, blog, SEO, and
              API usage · {date} (UTC)
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Live data — refresh to update
          </p>
        </div>
      </header>

      {/* OUTREACH */}
      <section className="mb-8 rounded-lg bg-white border border-gray-200 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Outreach (today)
            </h2>
            <p className="text-xs text-gray-500">
              Daily cold-email pipeline — pull leads → AI draft → Brevo send
            </p>
          </div>
          <Link
            href="/admin/outreach"
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Campaigns →
          </Link>
        </header>
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Sent" value={fmtNum(outreach.sentToday)} accent="emerald" />
          <Kpi label="Failed" value={fmtNum(outreach.failedToday)} accent="amber" />
          <Kpi
            label="Bounced"
            value={fmtNum(outreach.bouncedToday)}
            sub={`${bounceRate.toFixed(2)}%`}
            accent={bounceWarn ? "red" : "gray"}
          />
          <Kpi
            label="Complaints"
            value={fmtNum(outreach.complaintToday)}
            sub={`${complaintRate.toFixed(2)}%`}
            accent={complaintWarn ? "red" : "gray"}
          />
          <Kpi
            label="Unsubscribes"
            value={fmtNum(outreach.unsubscribedToday)}
            accent="gray"
          />
          <Kpi
            label="New leads"
            value={fmtNum(outreach.newContactsToday)}
            sub="pulled from Apollo"
            accent="blue"
          />
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Pending queue:{" "}
            <strong className="text-gray-900">{fmtNum(outreach.pending)}</strong>
          </span>
          <span>
            Active campaigns:{" "}
            <strong className="text-gray-900">
              {fmtNum(outreach.campaignsActive)}
            </strong>
          </span>
          {(bounceWarn || complaintWarn) && (
            <span className="text-red-700 font-medium">
              ⚠ Deliverability degraded — review before next cron run
            </span>
          )}
        </div>
        {outreach.recentSends.length > 0 && (
          <div className="border-t border-gray-100">
            <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Recent sends
            </p>
            <ul className="divide-y divide-gray-100">
              {outreach.recentSends.map((s, i) => (
                <li
                  key={i}
                  className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {s.subject}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {s.email}
                      {s.company && ` · ${s.company}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400 shrink-0">
                    <p
                      className={`px-1.5 py-0.5 rounded inline-block ${
                        s.status === "sent"
                          ? "bg-emerald-50 text-emerald-700"
                          : s.status.includes("bounce")
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status}
                    </p>
                    <p className="mt-0.5">{fmtTime(s.sentAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* BLOG AUTOMATION */}
      <section className="mb-8 rounded-lg bg-white border border-gray-200 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Blog automation (today)
            </h2>
            <p className="text-xs text-gray-500">
              CSDN sync · AI translate · DevTo cross-post
            </p>
          </div>
          <Link
            href="/blog"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Live blog ↗
          </Link>
        </header>
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi
            label="DevTo today"
            value={fmtNum(blog.devtoPublishedToday)}
            sub={`${fmtNum(blog.devtoPublishedTotal)} total`}
            accent="blue"
          />
          <Kpi
            label="EN posts updated"
            value={fmtNum(blog.mdxEnUpdatedToday)}
            sub="by translate-blog"
            accent="emerald"
          />
          <Kpi
            label="ZH posts updated"
            value={fmtNum(blog.mdxZhUpdatedToday)}
            sub="by sync-blog"
            accent="purple"
          />
          <Kpi
            label="Blog → DevTo lag"
            value={
              blog.devtoPublishedToday === 0 && blog.mdxEnUpdatedToday > 0
                ? "queued"
                : "in sync"
            }
            accent="gray"
          />
        </div>
        {blog.recentDevTo.length > 0 && (
          <div className="border-t border-gray-100">
            <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Last 5 DevTo publishes
            </p>
            <ul className="divide-y divide-gray-100">
              {blog.recentDevTo.map((p, i) => (
                <li key={i} className="px-5 py-2.5 text-sm">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block hover:bg-gray-50 -mx-5 px-5 py-0.5 transition-colors"
                  >
                    <p className="font-medium text-gray-900 truncate">
                      {p.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(p.publishedAt).toLocaleString()}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* SEO */}
      <section className="mb-8 rounded-lg bg-white border border-gray-200 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              SEO snapshot
            </h2>
            <p className="text-xs text-gray-500">
              Google Search Console · seo-daily cron
              {seo?.date && ` · ${seo.date}`}
            </p>
          </div>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Open GSC ↗
          </a>
        </header>
        {seo ? (
          <>
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi
                label="Clicks"
                value={seo.totalClicks != null ? fmtNum(seo.totalClicks) : "—"}
                accent="blue"
              />
              <Kpi
                label="Impressions"
                value={
                  seo.totalImpressions != null
                    ? fmtNum(seo.totalImpressions)
                    : "—"
                }
                accent="gray"
              />
              <Kpi
                label="Avg position"
                value={
                  seo.avgPosition != null ? seo.avgPosition.toFixed(1) : "—"
                }
                accent="gray"
              />
              <Kpi
                label="Indexed sample"
                value={
                  seo.coverage
                    ? `${seo.coverage.pass}/${seo.coverage.sampleSize}`
                    : "—"
                }
                sub={seo.coverage ? `${seo.coverage.fail} fail` : ""}
                accent={
                  seo.coverage && seo.coverage.fail > 0 ? "red" : "emerald"
                }
              />
            </div>
            {seo.topQueries && seo.topQueries.length > 0 && (
              <div className="border-t border-gray-100">
                <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Top queries
                </p>
                <ul className="divide-y divide-gray-100">
                  {seo.topQueries.map((q, i) => (
                    <li
                      key={i}
                      className="px-5 py-2 flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-900 truncate">{q.query}</span>
                      <span className="text-xs text-gray-500 tabular-nums shrink-0 ml-3">
                        {fmtNum(q.clicks)} clicks · {fmtNum(q.impressions)} impr
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="p-5 text-sm text-gray-500">
            No SEO snapshots found. seo-daily cron may not have run yet, or{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">
              data/seo-reports/
            </code>{" "}
            isn&apos;t in the deployed bundle.
          </p>
        )}
      </section>

      {/* API USAGE */}
      <section className="rounded-lg bg-white border border-gray-200 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              API usage (today)
            </h2>
            <p className="text-xs text-gray-500">
              External service calls — visibility into cost + reliability
            </p>
          </div>
          <Link
            href="/admin/system/usage"
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Trend →
          </Link>
        </header>
        <div className="px-5 py-4">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {fmtNum(apiUsage.totalToday)}
          </p>
          <p className="text-xs text-gray-500">total calls today</p>
        </div>
        {apiUsage.byService.length > 0 ? (
          <div className="border-t border-gray-100">
            <ul className="divide-y divide-gray-100">
              {apiUsage.byService.map((s) => (
                <li
                  key={s.service}
                  className="px-5 py-2.5 flex items-center justify-between text-sm"
                >
                  <span className="text-gray-900 font-medium capitalize">
                    {s.service}
                  </span>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {fmtNum(s.success)} ok
                    {s.failed > 0 && (
                      <span className="text-red-600 ml-2">
                        · {fmtNum(s.failed)} failed
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-gray-500">No API calls today.</p>
        )}
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent = "gray",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "gray" | "blue" | "emerald" | "amber" | "red" | "purple";
}) {
  const colors: Record<typeof accent, string> = {
    gray: "bg-gray-50 text-gray-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <span
        className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${colors[accent]}`}
      >
        {label}
      </span>
      <p className="mt-2 text-xl font-bold text-gray-900 tabular-nums">
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 truncate">{sub}</p>}
    </div>
  );
}
