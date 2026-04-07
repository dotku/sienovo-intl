"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

interface Message {
  id: string;
  content: string;
  isAdmin: boolean;
  user: { name: string | null; email: string } | null;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user: { email: string; name: string | null; companyName: string | null };
  messages: Message[];
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-yellow-50 text-yellow-700 border-yellow-200",
  resolved: "bg-green-50 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUSES = ["open", "in_progress", "resolved", "closed"];

export default function AdminTicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { dict } = useI18n();
  const t = dict.admin?.ticketsAdmin || {};
  const tt = dict.dashboard?.tickets || {};
  const td = dict.dashboard?.ticketDetail || {};
  const tn = dict.dashboard?.newTicket || {};

  useEffect(() => {
    fetch(`/api/admin/tickets/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setTicket)
      .finally(() => setLoading(false));
  }, [id]);

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

  const handleStatusChange = async (status: string) => {
    setUpdatingStatus(true);
    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok && ticket) setTicket({ ...ticket, status });
    setUpdatingStatus(false);
  };

  const handleReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/admin/tickets/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply }),
    });
    if (res.ok) {
      const msg = await res.json();
      setTicket((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev
      );
      setReply("");
      // Auto-mark as in_progress if currently open
      if (ticket?.status === "open") {
        handleStatusChange("in_progress");
      }
    }
    setSending(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500">{dict.admin?.common?.loading || "Loading..."}</div>;
  if (!ticket) return <div className="flex items-center justify-center py-20 text-gray-500">{td.notFound || "Ticket not found"}</div>;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <button
        onClick={() => router.push("/admin/tickets")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {t.backToList || "Back to Tickets"}
      </button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h1 className="text-xl font-bold text-gray-900">{ticket.subject}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[ticket.status]}`}>
                {statusLabel(ticket.status)}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
                {typeLabel(ticket.type)}
              </span>
              <span className="text-xs text-gray-400">
                {td.created || "Created"} {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-4 ${
                  msg.isAdmin
                    ? "bg-blue-50 border border-blue-100 ml-8"
                    : "bg-white border border-gray-200 mr-8"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">
                      {msg.isAdmin
                        ? (td.supportTeam || "Sienovo Team")
                        : (msg.user?.name || msg.user?.email || ticket.user.email)}
                    </span>
                    {msg.isAdmin && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                        {t.staff || "Staff"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Reply form */}
          {ticket.status !== "closed" && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.replyTitle || "Reply to Customer"}</h3>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t.replyPlaceholder || "Write a reply to the customer..."}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:border-gray-900 mb-3"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                  className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300"
                >
                  {sending ? (td.sending || "Sending...") : (td.sendReply || "Send Reply")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.customer || "Customer"}</h3>
            <div className="space-y-2 text-sm">
              {ticket.user.name && (
                <div>
                  <p className="text-xs text-gray-500">{t.name || "Name"}</p>
                  <p className="text-gray-900 font-medium">{ticket.user.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">{t.email || "Email"}</p>
                <a href={`mailto:${ticket.user.email}`} className="text-accent hover:underline">
                  {ticket.user.email}
                </a>
              </div>
              {ticket.user.companyName && (
                <div>
                  <p className="text-xs text-gray-500">{t.company || "Company"}</p>
                  <p className="text-gray-900">{ticket.user.companyName}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status Control */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t.changeStatus || "Change Status"}</h3>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updatingStatus || ticket.status === s}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    ticket.status === s
                      ? `${STATUS_COLORS[s]} font-semibold cursor-default`
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
