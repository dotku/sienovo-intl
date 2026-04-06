"use client";

import { useI18n } from "@/lib/i18n/context";
import { type ReactNode } from "react";

interface ServicePlan {
  monthly: number;
  daily?: number;
  label: string;
}

interface ActionRow {
  service: string;
  action: string;
  _count: number;
}

interface RecentCall {
  id: string;
  service: string;
  action: string;
  success: boolean;
  createdAt: string;
}

interface UsageViewProps {
  planLimits: Record<string, ServicePlan>;
  monthlyMap: Record<string, number>;
  dailyMap: Record<string, number>;
  actionCounts: ActionRow[];
  recent: RecentCall[];
  brevoCredits: number | null;
  fillButtons: Record<string, ReactNode>;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

export default function UsageView({
  planLimits,
  monthlyMap,
  dailyMap,
  actionCounts,
  recent,
  brevoCredits,
  fillButtons,
}: UsageViewProps) {
  const { dict } = useI18n();
  const t = dict.admin?.usage || {};

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">{t.title || "API Usage"}</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Object.entries(planLimits).map(([service, plan]) => {
          const used = monthlyMap[service] || 0;
          const today = dailyMap[service] || 0;
          const remaining = plan.monthly - used;
          const pct = Math.min(100, (used / plan.monthly) * 100);
          const isWarning = pct > 80;
          const dailyPct = plan.daily
            ? Math.min(100, (today / plan.daily) * 100)
            : 0;
          const dailyWarning = plan.daily ? dailyPct >= 100 : false;

          return (
            <div
              key={service}
              className={`bg-white rounded-lg border p-5 ${
                dailyWarning
                  ? "border-red-300 bg-red-50/30"
                  : isWarning
                    ? "border-amber-300"
                    : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {plan.label}
                </h3>
                {service === "brevo" && brevoCredits !== null && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {(t.live || "{count} live").replace("{count}", String(brevoCredits))}
                  </span>
                )}
                {dailyWarning && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {t.exceeded || "Exceeded"}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                {used}
                <span className="text-sm font-normal text-gray-400">
                  /{plan.monthly}
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isWarning ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>{(t.remaining || "{count} remaining").replace("{count}", String(remaining))}</span>
                <span>{(t.today || "{count} today").replace("{count}", String(today))}</span>
              </div>
              {plan.daily && (
                <div className="mt-2">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{t.daily || "Daily"}</span>
                      {fillButtons[service]}
                    </div>
                    <span
                      className={
                        dailyPct >= 100
                          ? "text-red-600 font-medium"
                          : dailyPct > 80
                            ? "text-amber-600 font-medium"
                            : "text-gray-500"
                      }
                    >
                      {today}/{plan.daily}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        dailyPct >= 100
                          ? "bg-red-500"
                          : dailyPct > 80
                            ? "bg-amber-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${dailyPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {t.monthlyBreakdown || "Monthly Breakdown"}
          </h3>
          {actionCounts.length === 0 ? (
            <p className="text-sm text-gray-500">{t.noApiThisMonth || "No API calls this month."}</p>
          ) : (
            <div className="space-y-2">
              {actionCounts.map((row) => (
                <div
                  key={`${row.service}-${row.action}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-gray-700">
                      {planLimits[row.service]?.label || row.service}
                    </span>
                    <span className="text-gray-400">{row.action}</span>
                  </div>
                  <span className="font-medium text-gray-900 tabular-nums">
                    {row._count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">{t.recentCalls || "Recent Calls"}</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">{t.noApiYet || "No API calls recorded yet."}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {recent.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between text-xs py-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        call.success ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <span className="font-medium text-gray-700">
                      {planLimits[call.service]?.label || call.service}
                    </span>
                    <span className="text-gray-400">{call.action}</span>
                  </div>
                  <span className="text-gray-400 whitespace-nowrap">
                    {formatDate(call.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
