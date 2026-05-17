"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface Ticket {
  id: string;
  subject: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  // The Prisma schema marks `user` as required, but in practice the API
  // can return null here for orphaned rows (e.g. tickets created before
  // the cascade rule landed, or via a backfill that bypassed the FK).
  // Treating it as nullable on the client keeps the list from crashing.
  user: {
    email: string;
    name: string | null;
    companyName: string | null;
  } | null;
  _count: { messages: number };
}

// Aligns with /admin (dashboard) — open is the action-required state, so
// it gets the amber treatment instead of the previously-blue tile.
const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
  closed: "bg-gray-100 text-gray-600",
};
const STATUS_FALLBACK = "bg-gray-100 text-gray-600";

const TYPE_COLORS: Record<string, string> = {
  inquiry: "bg-purple-50 text-purple-700",
  purchase: "bg-emerald-50 text-emerald-700",
  support: "bg-orange-50 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

const STATUS_TABS = ["all", "open", "in_progress", "resolved", "closed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { dict } = useI18n();
  const t = dict.admin?.ticketsAdmin || {};
  const tt = dict.dashboard?.tickets || {};
  const tn = dict.dashboard?.newTicket || {};

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tickets")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = (s: string) =>
    ({
      open: tt.open || "Open",
      in_progress: tt.inProgress || "In Progress",
      resolved: tt.resolved || "Resolved",
      closed: tt.closed || "Closed",
    })[s] || s;

  const typeLabel = (tp: string) =>
    ({
      inquiry: tn.typeInquiry || "Inquiry",
      purchase: tn.typePurchase || "Purchase",
      support: tn.typeSupport || "Support",
      other: tn.typeOther || "Other",
    })[tp] || tp;

  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((x) => x.status === "open").length,
      in_progress: tickets.filter((x) => x.status === "in_progress").length,
      resolved: tickets.filter((x) => x.status === "resolved").length,
      closed: tickets.filter((x) => x.status === "closed").length,
    }),
    [tickets],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((tk) => {
      if (statusFilter !== "all" && tk.status !== statusFilter) return false;
      if (typeFilter !== "all" && tk.type !== typeFilter) return false;
      if (!q) return true;
      const u = tk.user;
      return (
        tk.subject.toLowerCase().includes(q) ||
        (u?.email.toLowerCase().includes(q) ?? false) ||
        (u?.name?.toLowerCase().includes(q) ?? false) ||
        (u?.companyName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tickets, statusFilter, typeFilter, search]);

  const hasActiveFilter =
    statusFilter !== "all" || typeFilter !== "all" || search.trim() !== "";

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t.title || "Tickets"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t.subtitle || "Manage customer inquiries and support requests"}
        </p>
      </header>

      {/* Stats — match dashboard KPI card density and rhythm */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {STATUS_TABS.map((s) => {
          const active = statusFilter === s;
          const label =
            s === "all" ? tt.all || "All" : statusLabel(s);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={active}
              className={`text-left p-4 rounded-lg border transition-all ${
                active
                  ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                  : "bg-white border-gray-200 hover:border-gray-400 hover:shadow-sm"
              }`}
            >
              <p
                className={`text-xs font-medium ${active ? "text-gray-300" : "text-gray-500"}`}
              >
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {counts[s]}
              </p>
            </button>
          );
        })}
      </section>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            t.searchPlaceholder ||
            "Search by subject, customer email, name or company…"
          }
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        >
          <option value="all">{t.allTypes || "All Types"}</option>
          <option value="inquiry">{tn.typeInquiry || "Inquiry"}</option>
          <option value="purchase">{tn.typePurchase || "Purchase"}</option>
          <option value="support">{tn.typeSupport || "Support"}</option>
          <option value="other">{tn.typeOther || "Other"}</option>
        </select>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setTypeFilter("all");
              setSearch("");
            }}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 whitespace-nowrap"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <TicketListSkeleton />
      ) : loadError ? (
        <div className="bg-red-50 border border-red-100 rounded-lg p-6 text-sm text-red-700">
          Failed to load tickets ({loadError}). Refresh to retry.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            {hasActiveFilter
              ? t.noTickets || "No tickets match your filters."
              : "No tickets yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filtered.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/admin/tickets/${ticket.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[ticket.status] || STATUS_FALLBACK
                        }`}
                      >
                        {statusLabel(ticket.status)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          TYPE_COLORS[ticket.type] || TYPE_COLORS.other
                        }`}
                      >
                        {typeLabel(ticket.type)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {ticket.subject}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 mt-1">
                      <span className="truncate">
                        {ticket.user
                          ? ticket.user.name || ticket.user.email
                          : "Unknown user"}
                      </span>
                      {ticket.user?.companyName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">
                            {ticket.user.companyName}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {ticket._count.messages} {tt.messages || "messages"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400 shrink-0 whitespace-nowrap pt-0.5">
                    {relativeTime(ticket.updatedAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

function TicketListSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <ul className="divide-y divide-gray-100" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="px-5 py-4 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="h-4 w-12 rounded-full bg-gray-200" />
                  <div className="h-4 w-16 rounded-full bg-gray-200" />
                </div>
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
              <div className="h-3 w-10 rounded bg-gray-100 shrink-0" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
