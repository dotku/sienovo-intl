/**
 * Aggregator for bot/automation activity reports surfaced at /admin/reports.
 *
 * Reads from three sources:
 *   - Prisma DB (Outreach* tables, Contact, ApiUsage)
 *   - data/devto-published.jsonl (line-delimited JSON, one per article)
 *   - data/seo-reports/{YYYY-MM-DD}.json + coverage-{YYYY-MM-DD}.json
 *
 * Everything is fetched live (no caching layer). Page should be marked
 * dynamic so a refresh always reflects today's activity.
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type BotReport = {
  date: string; // YYYY-MM-DD
  outreach: OutreachReport;
  blog: BlogReport;
  seo: SeoReport | null;
  apiUsage: ApiUsageReport;
};

type OutreachReport = {
  sentToday: number;
  failedToday: number;
  bouncedToday: number;
  complaintToday: number;
  unsubscribedToday: number;
  newContactsToday: number;
  pending: number; // current pending across all time
  campaignsActive: number;
  recentSends: {
    email: string;
    company: string | null;
    subject: string;
    sentAt: Date;
    status: string;
  }[];
};

type BlogReport = {
  devtoPublishedToday: number;
  devtoPublishedTotal: number;
  mdxEnUpdatedToday: number;
  mdxZhUpdatedToday: number;
  recentDevTo: { title: string; url: string; publishedAt: string }[];
};

type SeoReport = {
  date: string;
  totalClicks?: number;
  totalImpressions?: number;
  avgPosition?: number;
  topQueries?: { query: string; clicks: number; impressions: number }[];
  coverage?: {
    pass: number;
    neutral: number;
    fail: number;
    unknown: number;
    sampleSize: number;
  };
};

type ApiUsageReport = {
  totalToday: number;
  byService: { service: string; success: number; failed: number }[];
};

function startOfDayUtc(d: Date = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadOutreach(): Promise<OutreachReport> {
  const since = startOfDayUtc();
  const [
    sentToday,
    failedToday,
    bouncedToday,
    complaintToday,
    unsubscribedToday,
    newContactsToday,
    pending,
    campaignsActive,
    recentRows,
  ] = await Promise.all([
    prisma.outreachEmail.count({
      where: { status: "sent", sentAt: { gte: since } },
    }),
    prisma.outreachEmail.count({
      where: { status: "failed", updatedAt: { gte: since } },
    }),
    prisma.outreachEmail.count({
      where: {
        status: { in: ["bounced", "hard_bounced"] },
        updatedAt: { gte: since },
      },
    }),
    prisma.outreachEmail.count({
      where: {
        status: { in: ["complaint", "spam"] },
        updatedAt: { gte: since },
      },
    }),
    prisma.outreachEmail.count({
      where: { status: "unsubscribed", updatedAt: { gte: since } },
    }),
    prisma.contact.count({
      where: { source: "apollo-outbound", createdAt: { gte: since } },
    }),
    prisma.outreachEmail.count({ where: { status: "pending" } }),
    prisma.outreachCampaign.count({ where: { status: "active" } }),
    prisma.outreachEmail.findMany({
      where: { sentAt: { gte: since } },
      orderBy: { sentAt: "desc" },
      take: 8,
      select: {
        subject: true,
        status: true,
        sentAt: true,
        contact: { select: { email: true, company: true } },
      },
    }),
  ]);

  return {
    sentToday,
    failedToday,
    bouncedToday,
    complaintToday,
    unsubscribedToday,
    newContactsToday,
    pending,
    campaignsActive,
    recentSends: recentRows
      .filter((r) => r.sentAt)
      .map((r) => ({
        email: r.contact.email,
        company: r.contact.company,
        subject: r.subject,
        sentAt: r.sentAt as Date,
        status: r.status,
      })),
  };
}

function loadBlog(): BlogReport {
  const today = todayIso();
  const repoRoot = process.cwd();

  // DevTo published list — line-delimited JSON
  let devtoLines: string[] = [];
  try {
    devtoLines = fs
      .readFileSync(path.join(repoRoot, "data/devto-published.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean);
  } catch {
    /* file missing — first run */
  }

  const devtoEntries = devtoLines
    .map((l) => {
      try {
        return JSON.parse(l) as {
          title?: string;
          dev_to_url?: string;
          published_at?: string;
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is NonNullable<typeof e> => !!e);

  const devtoToday = devtoEntries.filter(
    (e) => e.published_at?.slice(0, 10) === today,
  );

  const recentDevTo = devtoEntries
    .filter((e) => e.published_at)
    .sort((a, b) => (b.published_at! > a.published_at! ? 1 : -1))
    .slice(0, 5)
    .map((e) => ({
      title: e.title || "(no title)",
      url: e.dev_to_url || "#",
      publishedAt: e.published_at!,
    }));

  // Blog content file modification count today
  function countUpdatedToday(dir: string): number {
    try {
      const start = startOfDayUtc().getTime();
      return fs
        .readdirSync(path.join(repoRoot, dir))
        .filter((f) => f.endsWith(".mdx"))
        .reduce((acc, f) => {
          try {
            const stat = fs.statSync(path.join(repoRoot, dir, f));
            return stat.mtimeMs >= start ? acc + 1 : acc;
          } catch {
            return acc;
          }
        }, 0);
    } catch {
      return 0;
    }
  }

  return {
    devtoPublishedToday: devtoToday.length,
    devtoPublishedTotal: devtoEntries.length,
    mdxEnUpdatedToday: countUpdatedToday("content/blog-en"),
    mdxZhUpdatedToday: countUpdatedToday("content/blog"),
    recentDevTo,
  };
}

function loadSeo(): SeoReport | null {
  const repoRoot = process.cwd();
  const dir = path.join(repoRoot, "data/seo-reports");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return null;
  }

  // Find the most recent daily snapshot — file named YYYY-MM-DD.json
  // (NOT analysis-*.md or coverage-*.json which are different artifacts).
  const dailySnapshots = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  const coverageSnapshots = files
    .filter((f) => /^coverage-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();

  if (dailySnapshots.length === 0 && coverageSnapshots.length === 0)
    return null;

  let date = "";
  let totalClicks: number | undefined;
  let totalImpressions: number | undefined;
  let avgPosition: number | undefined;
  let topQueries: SeoReport["topQueries"];
  let coverage: SeoReport["coverage"];

  if (dailySnapshots.length > 0) {
    try {
      const raw = fs.readFileSync(path.join(dir, dailySnapshots[0]), "utf8");
      const snap = JSON.parse(raw);
      date = snap.date || dailySnapshots[0].slice(0, 10);
      // The shape varies a bit between days — best-effort extraction.
      const gsc = snap.gsc || snap.searchConsole || snap;
      totalClicks = gsc.totalClicks ?? gsc.clicks ?? undefined;
      totalImpressions = gsc.totalImpressions ?? gsc.impressions ?? undefined;
      avgPosition = gsc.avgPosition ?? gsc.position ?? undefined;
      const queries = gsc.topQueries || gsc.queries || [];
      if (Array.isArray(queries)) {
        topQueries = queries.slice(0, 5).map(
          (q: { query?: string; clicks?: number; impressions?: number }) => ({
            query: q.query || "",
            clicks: q.clicks ?? 0,
            impressions: q.impressions ?? 0,
          }),
        );
      }
    } catch (err) {
      console.error("[bot-reports] SEO snapshot parse failed", err);
    }
  }

  if (coverageSnapshots.length > 0) {
    try {
      const raw = fs.readFileSync(path.join(dir, coverageSnapshots[0]), "utf8");
      const snap = JSON.parse(raw);
      if (!date) date = snap.date || coverageSnapshots[0].slice(9, 19);
      coverage = {
        pass: snap.buckets?.PASS ?? 0,
        neutral: snap.buckets?.NEUTRAL ?? 0,
        fail: snap.buckets?.FAIL ?? 0,
        unknown: snap.buckets?.UNKNOWN ?? 0,
        sampleSize: snap.sampleSize ?? 0,
      };
    } catch (err) {
      console.error("[bot-reports] coverage snapshot parse failed", err);
    }
  }

  return {
    date,
    totalClicks,
    totalImpressions,
    avgPosition,
    topQueries,
    coverage,
  };
}

async function loadApiUsage(): Promise<ApiUsageReport> {
  const since = startOfDayUtc();
  const rows = await prisma.apiUsage.groupBy({
    by: ["service", "success"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  const map = new Map<string, { success: number; failed: number }>();
  for (const r of rows) {
    const cur = map.get(r.service) || { success: 0, failed: 0 };
    if (r.success) cur.success += r._count._all;
    else cur.failed += r._count._all;
    map.set(r.service, cur);
  }

  const byService = Array.from(map.entries())
    .map(([service, counts]) => ({ service, ...counts }))
    .sort((a, b) => b.success + b.failed - (a.success + a.failed));

  const totalToday = byService.reduce((a, b) => a + b.success + b.failed, 0);

  return { totalToday, byService };
}

export async function loadBotReport(): Promise<BotReport> {
  const [outreach, apiUsage] = await Promise.all([
    loadOutreach(),
    loadApiUsage(),
  ]);
  const blog = loadBlog();
  const seo = loadSeo();
  return { date: todayIso(), outreach, blog, seo, apiUsage };
}
