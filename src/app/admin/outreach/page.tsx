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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
};

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.admin?.outreach || {};
  const tc = dict.admin?.common || {};

  useEffect(() => {
    fetch("/api/admin/outreach/campaigns")
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data);
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
