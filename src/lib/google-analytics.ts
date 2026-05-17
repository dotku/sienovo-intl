/**
 * Google Analytics 4 Data API wrapper.
 *
 * Reuses the same env shape as the autoclaw project so the service-account
 * JSON can be shared between repos:
 *   GA_SERVICE_ACCOUNT_KEY = raw JSON of a service-account key with read
 *                            access to the GA4 property.
 *   GA_PROPERTY_ID         = numeric GA4 property ID (NOT the `G-...`
 *                            measurement ID). Look up under GA Admin →
 *                            Property settings.
 *
 * When either var is missing, `fetchGaSummary` returns `null` so callers
 * can degrade gracefully (the dashboard renders a "configure GA" hint
 * instead of error-screening). Network/permission errors collapse to the
 * same null path so a broken GA never 500s the admin home.
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type GaSummary = {
  totalUsers: number;
  sessions: number;
  pageViews: number;
  /** Date range covered. */
  startDate: string;
  endDate: string;
};

export type GaDailyPoint = {
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  users: number;
  sessions: number;
  pageViews: number;
};

let cachedClient: BetaAnalyticsDataClient | null = null;
function getClient(): BetaAnalyticsDataClient | null {
  if (cachedClient) return cachedClient;
  const raw = process.env.GA_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    cachedClient = new BetaAnalyticsDataClient({ credentials });
    return cachedClient;
  } catch (err) {
    console.error("[ga] GA_SERVICE_ACCOUNT_KEY is not valid JSON:", err);
    return null;
  }
}

export function getGaPropertyId(): string | null {
  return process.env.GA_PROPERTY_ID || null;
}

/**
 * Fetch totals for the given date range. `startDate`/`endDate` use GA4's
 * relative-date syntax (e.g. "7daysAgo", "today", "2026-05-01").
 */
export async function fetchGaSummary(
  startDate: string = "7daysAgo",
  endDate: string = "today",
): Promise<GaSummary | null> {
  const client = getClient();
  const propertyId = getGaPropertyId();
  if (!client || !propertyId) return null;

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
      ],
    });
    const vals = response.rows?.[0]?.metricValues;
    return {
      totalUsers: Number(vals?.[0]?.value || 0),
      sessions: Number(vals?.[1]?.value || 0),
      pageViews: Number(vals?.[2]?.value || 0),
      startDate,
      endDate,
    };
  } catch (err) {
    console.error("[ga] runReport failed:", err);
    return null;
  }
}

/**
 * Fetch daily breakdown (one row per day). Used by the dashboard line
 * chart. `nDays` is how many days back from today (inclusive).
 */
export async function fetchGaDaily(
  nDays: number = 30,
): Promise<GaDailyPoint[] | null> {
  const client = getClient();
  const propertyId = getGaPropertyId();
  if (!client || !propertyId) return null;

  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${nDays - 1}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
      ],
      orderBys: [
        {
          dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" },
        },
      ],
    });
    const out: GaDailyPoint[] = [];
    for (const row of response.rows || []) {
      const raw = row.dimensionValues?.[0]?.value || "";
      // GA returns "YYYYMMDD"; normalize to ISO "YYYY-MM-DD".
      const date =
        raw.length === 8
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : raw;
      out.push({
        date,
        users: Number(row.metricValues?.[0]?.value || 0),
        sessions: Number(row.metricValues?.[1]?.value || 0),
        pageViews: Number(row.metricValues?.[2]?.value || 0),
      });
    }
    return out;
  } catch (err) {
    console.error("[ga] daily runReport failed:", err);
    return null;
  }
}
