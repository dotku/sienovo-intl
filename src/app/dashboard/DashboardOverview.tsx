"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
}

export default function DashboardOverview({
  userName,
  openCount,
  resolvedCount,
  recentTickets,
}: {
  userName: string;
  openCount: number;
  resolvedCount: number;
  recentTickets: Ticket[];
}) {
  const { dict } = useI18n();
  const t = dict.dashboard?.overview || {};
  const tt = dict.dashboard?.tickets || {};

  const hour = new Date().getHours();
  const greeting = hour < 12
    ? (t.goodMorning || "Good morning")
    : hour < 18
      ? (t.goodAfternoon || "Good afternoon")
      : (t.goodEvening || "Good evening");

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: tt.open || "Open",
      in_progress: tt.inProgress || "In Progress",
      resolved: tt.resolved || "Resolved",
      closed: tt.closed || "Closed",
    };
    return map[s] || s;
  };

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {greeting}{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t.subtitle || "Manage your inquiries, track orders, and get support."}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{openCount}</div>
          <p className="text-xs text-gray-500 mt-0.5">{t.openTickets || "Open Tickets"}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{resolvedCount}</div>
          <p className="text-xs text-gray-500 mt-0.5">{t.resolved || "Resolved"}</p>
        </div>

        <Link href="/dashboard/tickets/new" className="col-span-2 bg-gray-900 text-white rounded-xl p-4 sm:p-5 hover:bg-gray-800 transition-colors flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <div className="font-semibold">{t.newTicket || "New Ticket"}</div>
            <div className="text-xs text-gray-400">{t.newTicketDesc || "Create inquiry or support request"}</div>
          </div>
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.quickActions || "Quick Actions"}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <Link href="/dashboard/chat" className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-3 transition-colors">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{t.aiAssistant || "AI Assistant"}</h3>
          <p className="text-xs text-gray-500 mt-1">{t.aiAssistantDesc || "Ask about products, pricing, and shipping"}</p>
        </Link>

        <a href="https://calendly.com/sienovo" target="_blank" rel="noopener noreferrer" className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-green-200 hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-lg bg-green-50 group-hover:bg-green-100 flex items-center justify-center mb-3 transition-colors">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{t.requestDemo || "Request a Demo"}</h3>
          <p className="text-xs text-gray-500 mt-1">{t.requestDemoDesc || "Schedule a product demonstration"}</p>
        </a>

        <Link href="/dashboard/contact" className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-purple-200 hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-lg bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center mb-3 transition-colors">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{t.contactUs || "Contact Us"}</h3>
          <p className="text-xs text-gray-500 mt-1">{t.contactUsDesc || "Send a message to our team"}</p>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">{t.recentTickets || "Recent Tickets"}</h3>
          <Link href="/dashboard/tickets" className="text-xs font-medium text-accent hover:text-red-700 transition-colors">
            {t.viewAll || "View all"} &rarr;
          </Link>
        </div>
        {recentTickets.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <p className="text-sm text-gray-500 mb-3">{t.noTickets || "No tickets yet"}</p>
            <Link href="/dashboard/tickets/new" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-red-700">
              {t.createFirst || "Create your first ticket"} &rarr;
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentTickets.map((ticket) => (
              <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-medium ${
                  ticket.status === "open" ? "bg-blue-50 text-blue-700" :
                  ticket.status === "in_progress" ? "bg-yellow-50 text-yellow-700" :
                  ticket.status === "resolved" ? "bg-green-50 text-green-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {statusLabel(ticket.status)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
