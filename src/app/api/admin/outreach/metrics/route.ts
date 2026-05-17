import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Top-level outreach marketing report. One query gives us:
//   - Lifetime funnel: sent → delivered → opened → clicked → replied
//   - Bounce / complaint / unsubscribe counts (sender-health signal)
//   - 14-day daily volume for the sparkline
//   - Per-campaign open / click / reply rates
//   - Per-step open / click / reply rates (to spot weak subject lines)

interface FunnelStage {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  complaint: number;
  unsubscribed: number;
}

interface CampaignStat {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

interface DailyVolume {
  date: string;
  sent: number;
  opened: number;
  replied: number;
}

export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  // Lifetime aggregates — one raw query, fastest at scale
  const lifetime = await prisma.$queryRaw<Array<FunnelStage>>`
    SELECT
      COUNT(*) FILTER (WHERE "sentAt" IS NOT NULL)::int        AS sent,
      COUNT(*) FILTER (WHERE "deliveredAt" IS NOT NULL)::int   AS delivered,
      COUNT(*) FILTER (WHERE "openedAt" IS NOT NULL)::int      AS opened,
      COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL)::int     AS clicked,
      COUNT(*) FILTER (WHERE "repliedAt" IS NOT NULL)::int     AS replied,
      COUNT(*) FILTER (WHERE "bouncedAt" IS NOT NULL)::int     AS bounced,
      COUNT(*) FILTER (WHERE "complaintAt" IS NOT NULL)::int   AS complaint,
      COUNT(*) FILTER (WHERE "unsubscribedAt" IS NOT NULL)::int AS unsubscribed
    FROM "OutreachEmail"
  `;

  // Per-campaign metrics
  const byCampaign = await prisma.$queryRaw<Array<CampaignStat>>`
    SELECT
      c.id,
      c.name,
      c.status,
      COUNT(e.*) FILTER (WHERE e."sentAt" IS NOT NULL)::int      AS sent,
      COUNT(e.*) FILTER (WHERE e."deliveredAt" IS NOT NULL)::int AS delivered,
      COUNT(e.*) FILTER (WHERE e."openedAt" IS NOT NULL)::int    AS opened,
      COUNT(e.*) FILTER (WHERE e."clickedAt" IS NOT NULL)::int   AS clicked,
      COUNT(e.*) FILTER (WHERE e."repliedAt" IS NOT NULL)::int   AS replied,
      COUNT(e.*) FILTER (WHERE e."bouncedAt" IS NOT NULL)::int   AS bounced
    FROM "OutreachCampaign" c
    LEFT JOIN "OutreachEmail" e ON e."campaignId" = c.id
    GROUP BY c.id, c.name, c.status
    ORDER BY sent DESC, c."createdAt" DESC
  `;

  // 14-day daily volume
  const daily = await prisma.$queryRaw<Array<DailyVolume>>`
    SELECT
      to_char(date_series::date, 'YYYY-MM-DD') AS date,
      COUNT(e.*) FILTER (WHERE e."sentAt"::date = date_series::date)::int     AS sent,
      COUNT(e.*) FILTER (WHERE e."openedAt"::date = date_series::date)::int   AS opened,
      COUNT(e.*) FILTER (WHERE e."repliedAt"::date = date_series::date)::int  AS replied
    FROM generate_series(
      (NOW() - INTERVAL '13 days')::date,
      NOW()::date,
      '1 day'::interval
    ) AS date_series
    LEFT JOIN "OutreachEmail" e ON
      e."sentAt"::date = date_series::date OR
      e."openedAt"::date = date_series::date OR
      e."repliedAt"::date = date_series::date
    GROUP BY date_series
    ORDER BY date_series ASC
  `;

  // Contact / campaign meta
  const contactCount = await prisma.contact.count();
  const activeCampaigns = await prisma.outreachCampaign.count({
    where: { status: "active" },
  });

  return NextResponse.json({
    lifetime: lifetime[0] || {
      sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0,
      bounced: 0, complaint: 0, unsubscribed: 0,
    },
    byCampaign,
    daily,
    contactCount,
    activeCampaigns,
    generatedAt: new Date().toISOString(),
  });
}
