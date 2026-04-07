import { prisma } from "@/lib/prisma";
import FillButton from "./fill-button";
import UsageView from "./UsageView";

const PLAN_LIMITS: Record<string, { monthly: number; daily?: number; label: string }> = {
  apollo: { monthly: 10000, label: "Apollo" },
  snov: { monthly: 50, label: "Snov.io" },
  gemini: { monthly: 600, daily: 20, label: "Gemini" },
  cerebras: { monthly: 10000, label: "Cerebras" },
  deepseek: { monthly: 10000, label: "DeepSeek" },
  brevo: { monthly: 9000, label: "Brevo" },
  google: { monthly: 25000, label: "Google Contacts" },
};

export const dynamic = "force-dynamic";

async function getUsageStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const monthlyCounts = await prisma.apiUsage.groupBy({
    by: ["service"],
    _count: true,
    where: { createdAt: { gte: startOfMonth } },
  });

  const dailyCounts = await prisma.apiUsage.groupBy({
    by: ["service"],
    _count: true,
    where: { createdAt: { gte: startOfDay } },
  });

  const recent = await prisma.apiUsage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const actionCounts = await prisma.apiUsage.groupBy({
    by: ["service", "action"],
    _count: true,
    where: { createdAt: { gte: startOfMonth } },
  });

  const monthlyMap: Record<string, number> = {};
  for (const row of monthlyCounts) {
    monthlyMap[row.service] = row._count;
  }

  const dailyMap: Record<string, number> = {};
  for (const row of dailyCounts) {
    dailyMap[row.service] = row._count;
  }

  let brevoCredits: number | null = null;
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": brevoKey },
      });
      if (res.ok) {
        const data = await res.json();
        const freePlan = data.plan?.find(
          (p: { type: string; credits: number }) => p.type === "free"
        );
        if (freePlan) brevoCredits = freePlan.credits;
      }
    } catch {}
  }

  return { monthlyMap, dailyMap, recent, actionCounts, brevoCredits };
}

export default async function UsagePage() {
  const { monthlyMap, dailyMap, recent, actionCounts, brevoCredits } =
    await getUsageStats();

  // Build fill buttons for services with daily limits (server component)
  const fillButtons: Record<string, React.ReactNode> = {};
  for (const [service, plan] of Object.entries(PLAN_LIMITS)) {
    if (plan.daily) {
      fillButtons[service] = (
        <FillButton service={service} daily={plan.daily} current={dailyMap[service] || 0} />
      );
    }
  }

  return (
    <UsageView
      planLimits={PLAN_LIMITS}
      monthlyMap={monthlyMap}
      dailyMap={dailyMap}
      actionCounts={actionCounts.map((r) => ({
        service: r.service,
        action: r.action,
        _count: r._count,
      }))}
      recent={recent.map((r) => ({
        id: r.id,
        service: r.service,
        action: r.action,
        success: r.success,
        createdAt: r.createdAt.toISOString(),
      }))}
      brevoCredits={brevoCredits}
      fillButtons={fillButtons}
    />
  );
}
