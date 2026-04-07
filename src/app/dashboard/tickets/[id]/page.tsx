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
  messages: Message[];
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const { dict } = useI18n();
  const t = dict.dashboard?.ticketDetail || {};
  const tt = dict.dashboard?.tickets || {};

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: tt.open || "Open",
      in_progress: tt.inProgress || "In Progress",
      resolved: tt.resolved || "Resolved",
      closed: tt.closed || "Closed",
    };
    return map[s] || s;
  };

  useEffect(() => {
    fetch(`/api/dashboard/tickets/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setTicket)
      .finally(() => setLoading(false));
  }, [id]);

  const handleReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/dashboard/tickets/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply }),
    });
    if (res.ok) {
      const msg = await res.json();
      setTicket((prev) =>
        prev ? { ...prev, messages: [...prev.messages, { ...msg, isAdmin: false, user: null }] } : prev
      );
      setReply("");
    }
    setSending(false);
  };

  const handleClose = async () => {
    await fetch(`/api/dashboard/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    setTicket((prev) => prev ? { ...prev, status: "closed" } : prev);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500">{dict.admin?.common?.loading || "Loading..."}</div>;
  if (!ticket) return <div className="flex items-center justify-center py-20 text-gray-500">{t.notFound || "Ticket not found"}</div>;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.push("/dashboard/tickets")} className="text-xs text-gray-400 hover:text-gray-600 mb-2">
            &larr; {t.backToTickets || "Back to tickets"}
          </button>
          <h2 className="text-lg font-semibold text-gray-900">{ticket.subject}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">{ticket.type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              ticket.status === "open" ? "bg-blue-50 text-blue-700" :
              ticket.status === "in_progress" ? "bg-yellow-50 text-yellow-700" :
              ticket.status === "resolved" ? "bg-green-50 text-green-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {statusLabel(ticket.status)}
            </span>
            <span className="text-xs text-gray-400">{t.created || "Created"} {new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
        </div>
        {ticket.status !== "closed" && (
          <button onClick={handleClose} className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 px-3 py-1.5 rounded">
            {t.closeTicket || "Close ticket"}
          </button>
        )}
      </div>

      <div className="space-y-4 mb-6">
        {ticket.messages.map((msg) => (
          <div key={msg.id} className={`rounded-lg p-4 ${msg.isAdmin ? "bg-blue-50 border border-blue-100 ml-6" : "bg-white border border-gray-200 mr-6"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700">
                {msg.isAdmin ? (t.supportTeam || "Sienovo Team") : (msg.user?.name || msg.user?.email || (t.you || "You"))}
              </span>
              <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t.replyPlaceholder || "Write a reply..."}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:border-gray-900 mb-3"
          />
          <div className="flex justify-end">
            <button onClick={handleReply} disabled={sending || !reply.trim()}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300">
              {sending ? (t.sending || "Sending...") : (t.sendReply || "Send Reply")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
