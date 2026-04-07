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
  user: { email: string; name: string | null; companyName: string | null };
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

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { dict } = useI18n();
  const t = dict.admin?.ticketsAdmin || {};
  const tt = dict.dashboard?.tickets || {};
  const tn = dict.dashboard?.newTicket || {};

  useEffect(() => {
    fetch("/api/admin/tickets")
      .then((r) => r.json())
      .then(setTickets)
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (s: string) => ({
    open: tt.open || "Open",
    in_progress: tt.inProgress || "In Progress",
    resolved: tt.resolved || "Resolved",
    closed: tt.closed || "Closed",
  })[s] || s;

  const typeLabel = (tp: string) => ({
    inquiry: tn.typeInquiry || "Inquiry",
    purchase: tn.typePurchase || "Purchase",
    support: tn.typeSupport || "Support",
    other: tn.typeOther || "Other",
  })[tp] || tp;

  const filtered = tickets.filter((tk) => {
    if (statusFilter !== "all" && tk.status !== statusFilter) return false;
    if (typeFilter !== "all" && tk.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !tk.subject.toLowerCase().includes(q) &&
        !tk.user.email.toLowerCase().includes(q) &&
        !(tk.user.name?.toLowerCase().includes(q)) &&
        !(tk.user.companyName?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.title || "Tickets"}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.subtitle || "Manage customer inquiries and support requests"}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              statusFilter === s ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-2xl font-bold">{counts[s]}</div>
            <div className={`text-xs ${statusFilter === s ? "text-gray-300" : "text-gray-500"}`}>
              {s === "all" ? (tt.all || "All") : statusLabel(s)}
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder || "Search by subject, customer email, name or company..."}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
        >
          <option value="all">{t.allTypes || "All Types"}</option>
          <option value="inquiry">{tn.typeInquiry || "Inquiry"}</option>
          <option value="purchase">{tn.typePurchase || "Purchase"}</option>
          <option value="support">{tn.typeSupport || "Support"}</option>
          <option value="other">{tn.typeOther || "Other"}</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center py-12 text-gray-400">{dict.admin?.common?.loading || "Loading..."}</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          {t.noTickets || "No tickets match your filters."}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filtered.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/admin/tickets/${ticket.id}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ticket.status]}`}>
                      {statusLabel(ticket.status)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[ticket.type] || TYPE_COLORS.other}`}>
                      {typeLabel(ticket.type)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{ticket.subject}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{ticket.user.name || ticket.user.email}</span>
                    {ticket.user.companyName && <span>· {ticket.user.companyName}</span>}
                    <span>· {ticket._count.messages} {tt.messages || "messages"}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400 shrink-0">
                  {new Date(ticket.updatedAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
