"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface Ticket {
  id: string;
  subject: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-yellow-50 text-yellow-700",
  resolved: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const TYPE_COLORS: Record<string, string> = {
  inquiry: "bg-purple-50 text-purple-700",
  purchase: "bg-emerald-50 text-emerald-700",
  support: "bg-orange-50 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const { dict } = useI18n();
  const t = dict.dashboard?.tickets || {};
  const tn = dict.dashboard?.newTicket || {};

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: t.open || "Open",
      in_progress: t.inProgress || "In Progress",
      resolved: t.resolved || "Resolved",
      closed: t.closed || "Closed",
    };
    return map[s] || s;
  };

  const typeLabel = (tp: string) => {
    const map: Record<string, string> = {
      inquiry: tn.typeInquiry || "Product Inquiry",
      purchase: tn.typePurchase || "Purchase / Order",
      support: tn.typeSupport || "Technical Support",
      other: tn.typeOther || "Other",
    };
    return map[tp] || tp;
  };

  const filterLabels: Record<string, string> = {
    all: t.all || "All",
    open: t.open || "Open",
    in_progress: t.inProgress || "In Progress",
    resolved: t.resolved || "Resolved",
    closed: t.closed || "Closed",
  };

  useEffect(() => {
    fetch("/api/dashboard/tickets")
      .then((r) => r.json())
      .then(setTickets)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{t.title || "My Tickets"}</h2>
        <Link
          href="/dashboard/tickets/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          {t.newTicket || "+ New Ticket"}
        </Link>
      </div>

      <div className="flex gap-1.5 mb-4">
        {["all", "open", "in_progress", "resolved", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-2.5 py-1 rounded-full ${
              filter === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filterLabels[s] || s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-12">{dict.admin?.common?.loading || "Loading..."}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">{t.noTickets || "No tickets found"}</p>
          <Link href="/dashboard/tickets/new" className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block">
            {t.createFirst || "Create your first ticket"}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {filtered.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/tickets/${ticket.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[ticket.type] || TYPE_COLORS.other}`}>
                    {typeLabel(ticket.type)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {ticket._count.messages} {t.messages || "messages"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(ticket.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full ml-4 shrink-0 ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
                {statusLabel(ticket.status)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
