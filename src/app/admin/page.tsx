import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth0";
import {
  fetchGaSummary,
  fetchGaDaily,
  type GaSummary,
  type GaDailyPoint,
} from "@/lib/google-analytics";
import TrafficChart from "./TrafficChart";

export const dynamic = "force-dynamic";

type KpiKey =
  | "products"
  | "tickets"
  | "contacts"
  | "companies"
  | "orders"
  | "outreach"
  | "vessels"
  | "knowledge";

type Kpi = {
  key: KpiKey;
  label: string;
  value: string;
  hint?: string;
  href: string;
  accent: string;
};

async function loadDashboardData() {
  // All counts in one round-trip-ish batch. Each query is independent, so
  // Promise.all keeps the page snappy. Anything that throws (e.g. a model
  // missing in a stale DB) is caught at the page level — we don't want one
  // bad query to 500 the whole admin home.
  const now = new Date();
  const day1Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    productTotal,
    productActive,
    ticketOpen,
    ticketTotal,
    contactsTotal,
    contactsLead,
    companiesTotal,
    ordersTotal,
    ordersPending,
    revenueAgg,
    campaignsTotal,
    campaignsActive,
    emailsPending,
    emailsSent,
    vesselsTotal,
    vesselsOnline,
    knowledgeArticles,
    knowledgeFiles,
    recentTickets,
    recentOrders,
    apiCalls24h,
    apiCalls7d,
    conversations7d,
    chatMessages7d,
    newContacts7d,
    outreachSent7d,
    tickets7d,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.ticket.count({ where: { status: "open" } }),
    prisma.ticket.count(),
    prisma.contact.count(),
    prisma.contact.count({ where: { isLead: true } }),
    prisma.company.count(),
    prisma.order.count(),
    prisma.order.count({
      where: { status: { in: ["pending", "confirmed", "processing"] } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ["shipped", "delivered"] } },
    }),
    prisma.outreachCampaign.count(),
    prisma.outreachCampaign.count({ where: { status: "active" } }),
    prisma.outreachEmail.count({ where: { status: "pending" } }),
    prisma.outreachEmail.count({ where: { status: "sent" } }),
    prisma.vessel.count(),
    prisma.vessel.count({ where: { isOnline: true } }),
    prisma.knowledgeArticle.count(),
    prisma.knowledgeFile.count({ where: { trashedAt: null } }),
    prisma.ticket.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        subject: true,
        status: true,
        updatedAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.apiUsage.count({ where: { createdAt: { gte: day1Ago } } }),
    prisma.apiUsage.count({ where: { createdAt: { gte: day7Ago } } }),
    prisma.conversation.count({ where: { createdAt: { gte: day7Ago } } }),
    prisma.chatMessage.count({ where: { createdAt: { gte: day7Ago } } }),
    prisma.contact.count({ where: { createdAt: { gte: day7Ago } } }),
    prisma.outreachEmail.count({
      where: { status: "sent", sentAt: { gte: day7Ago } },
    }),
    prisma.ticket.count({ where: { createdAt: { gte: day7Ago } } }),
  ]);

  return {
    productTotal,
    productActive,
    ticketOpen,
    ticketTotal,
    contactsTotal,
    contactsLead,
    companiesTotal,
    ordersTotal,
    ordersPending,
    revenue: revenueAgg._sum.totalAmount || 0,
    campaignsTotal,
    campaignsActive,
    emailsPending,
    emailsSent,
    vesselsTotal,
    vesselsOnline,
    knowledgeArticles,
    knowledgeFiles,
    recentTickets,
    recentOrders,
    apiCalls24h,
    apiCalls7d,
    conversations7d,
    chatMessages7d,
    newContacts7d,
    outreachSent7d,
    tickets7d,
  };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function relativeTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

const ALLOWED_RANGES = [7, 30, 90] as const;
type Range = (typeof ALLOWED_RANGES)[number];

function parseRange(raw: string | string[] | undefined): Range {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (ALLOWED_RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  const userName = session?.user?.name || session?.user?.email || "there";
  const params = await searchParams;
  const range = parseRange(params.range);

  let data;
  let ga7d: GaSummary | null = null;
  let ga30d: GaSummary | null = null;
  let gaDaily: GaDailyPoint[] | null = null;
  try {
    [data, ga7d, ga30d, gaDaily] = await Promise.all([
      loadDashboardData(),
      fetchGaSummary("7daysAgo", "today"),
      fetchGaSummary("30daysAgo", "today"),
      fetchGaDaily(range),
    ]);
  } catch (err) {
    console.error("[admin/dashboard] data load failed", err);
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Dashboard</h1>
        <div className="rounded-lg bg-red-50 border border-red-100 p-6 text-sm text-red-700">
          Failed to load dashboard data. Check Prisma connectivity, then
          refresh.
        </div>
      </main>
    );
  }

  const kpis: Kpi[] = [
    {
      key: "products",
      label: "Products",
      value: String(data.productTotal),
      hint: `${data.productActive} active`,
      href: "/admin/products",
      accent: "bg-blue-50 text-blue-700",
    },
    {
      key: "tickets",
      label: "Open tickets",
      value: String(data.ticketOpen),
      hint: `${data.ticketTotal} total`,
      href: "/admin/tickets",
      accent: "bg-amber-50 text-amber-700",
    },
    {
      key: "contacts",
      label: "Contacts",
      value: String(data.contactsTotal),
      hint: `${data.contactsLead} leads`,
      href: "/admin/crm",
      accent: "bg-emerald-50 text-emerald-700",
    },
    {
      key: "companies",
      label: "Companies",
      value: String(data.companiesTotal),
      href: "/admin/companies",
      accent: "bg-teal-50 text-teal-700",
    },
    {
      key: "orders",
      label: "Orders",
      value: String(data.ordersTotal),
      hint: `${data.ordersPending} in pipeline · ${formatCurrency(data.revenue)} fulfilled`,
      href: "/admin/products",
      accent: "bg-indigo-50 text-indigo-700",
    },
    {
      key: "outreach",
      label: "Outreach",
      value: String(data.campaignsActive),
      hint: `${data.campaignsTotal} campaigns · ${data.emailsPending} pending, ${data.emailsSent} sent`,
      href: "/admin/outreach",
      accent: "bg-purple-50 text-purple-700",
    },
    {
      key: "vessels",
      label: "Marine vessels",
      value: `${data.vesselsOnline}/${data.vesselsTotal}`,
      hint: "online / total",
      href: "/admin/marine",
      accent: "bg-cyan-50 text-cyan-700",
    },
    {
      key: "knowledge",
      label: "Knowledge base",
      value: String(data.knowledgeArticles + data.knowledgeFiles),
      hint: `${data.knowledgeArticles} articles · ${data.knowledgeFiles} files`,
      href: "/admin/system/knowledge",
      accent: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back, {userName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sienovo operations dashboard — quick snapshot across every system.
        </p>
      </header>

      {/* Traffic */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Traffic</h2>
            <p className="text-xs text-gray-500">
              Website analytics (Google Analytics 4) + platform activity
            </p>
          </div>
          <a
            href="https://analytics.google.com/analytics/web/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Open Google Analytics ↗
          </a>
        </div>

        {ga7d || ga30d || gaDaily ? (
          <div className="space-y-3 mb-3">
            {gaDaily && gaDaily.length > 0 && (
              <TrafficChart data={gaDaily} range={range} />
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-lg bg-white border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Users (7d)</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {(ga7d?.totalUsers ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {(ga30d?.totalUsers ?? 0).toLocaleString()} in last 30d
                </p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Sessions (7d)</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {(ga7d?.sessions ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {(ga30d?.sessions ?? 0).toLocaleString()} in last 30d
                </p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-4">
                <p className="text-xs text-gray-500">Pageviews (7d)</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {(ga7d?.pageViews ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {(ga30d?.pageViews ?? 0).toLocaleString()} in last 30d
                </p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-4">
                <p className="text-xs text-gray-500">API calls (7d)</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {data.apiCalls7d.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {data.apiCalls24h.toLocaleString()} in last 24h
                </p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-4">
                <p className="text-xs text-gray-500">AI conversations</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {data.conversations7d.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {data.chatMessages7d.toLocaleString()} messages · 7d
                </p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-4">
                <p className="text-xs text-gray-500">New contacts (7d)</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {data.newContacts7d.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {data.outreachSent7d.toLocaleString()} outreach emails sent
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-3 text-sm text-amber-900">
            <p className="font-medium">Google Analytics not configured.</p>
            <p className="mt-1 text-amber-800">
              Set <code className="px-1 py-0.5 rounded bg-amber-100">GA_SERVICE_ACCOUNT_KEY</code>{" "}
              (service-account JSON) and{" "}
              <code className="px-1 py-0.5 rounded bg-amber-100">GA_PROPERTY_ID</code>{" "}
              (numeric GA4 property ID) in{" "}
              <code className="px-1 py-0.5 rounded bg-amber-100">.env.local</code>{" "}
              to see real website traffic. The service account already used
              for autoclaw can be reused — just grant it Viewer access to
              the Sienovo GA4 property.
            </p>
          </div>
        )}

        {/* Internal platform activity remains visible even without GA */}
        {!ga7d && !ga30d && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: "API calls (7d)",
                value: data.apiCalls7d.toLocaleString(),
                hint: `${data.apiCalls24h.toLocaleString()} in last 24h`,
              },
              {
                label: "AI conversations",
                value: data.conversations7d.toLocaleString(),
                hint: `${data.chatMessages7d.toLocaleString()} messages · 7d`,
              },
              {
                label: "New contacts",
                value: data.newContacts7d.toLocaleString(),
                hint: "captured in 7d",
              },
              {
                label: "Outreach sent",
                value: data.outreachSent7d.toLocaleString(),
                hint: "emails in 7d",
              },
              {
                label: "New tickets",
                value: data.tickets7d.toLocaleString(),
                hint: "in 7d",
              },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-lg bg-white border border-gray-200 p-4"
              >
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {m.value}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {m.hint}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* KPI grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <Link
            key={k.key}
            href={k.href}
            className="group block rounded-lg bg-white border border-gray-200 p-5 hover:border-gray-900 hover:shadow-sm transition-all"
          >
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${k.accent}`}
            >
              {k.label}
            </span>
            <p className="mt-3 text-3xl font-bold text-gray-900 tabular-nums">
              {k.value}
            </p>
            {k.hint && (
              <p className="mt-1 text-xs text-gray-500 truncate">{k.hint}</p>
            )}
          </Link>
        ))}
      </section>

      {/* Recent activity */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent tickets
            </h2>
            <Link
              href="/admin/tickets"
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              View all →
            </Link>
          </div>
          {data.recentTickets.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No tickets yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentTickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/tickets/${t.id}`}
                    className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {t.subject}
                      </p>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                          t.status === "open"
                            ? "bg-amber-50 text-amber-700"
                            : t.status === "resolved"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      {t.user?.name || t.user?.email || "—"} ·{" "}
                      {relativeTime(t.updatedAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent orders
            </h2>
            <Link
              href="/admin/products"
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Catalog →
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {o.orderNumber}
                    </p>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        o.status === "delivered"
                          ? "bg-emerald-50 text-emerald-700"
                          : o.status === "cancelled"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {o.user?.name || o.user?.email || "—"}
                    {o.totalAmount != null && (
                      <>
                        {" · "}
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: o.currency || "USD",
                        }).format(o.totalAmount)}
                      </>
                    )}{" "}
                    · {relativeTime(o.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-8 rounded-lg bg-white border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { href: "/admin/chat", label: "AI chat" },
            { href: "/admin/products/new", label: "Add product" },
            { href: "/admin/outreach", label: "New campaign" },
            { href: "/admin/system/knowledge", label: "Knowledge base" },
            { href: "/admin/ads", label: "Ads" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="block rounded border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900 hover:bg-gray-50 transition-colors text-center"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
