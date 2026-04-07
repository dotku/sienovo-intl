"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

export default function NewTicketPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("inquiry");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { dict } = useI18n();
  const t = dict.dashboard?.newTicket || {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);

    const res = await fetch("/api/dashboard/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, type, message }),
    });

    if (res.ok) {
      const ticket = await res.json();
      router.push(`/dashboard/tickets/${ticket.id}`);
    }
    setSubmitting(false);
  };

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">{t.title || "New Ticket"}</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.type || "Type"}</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
          >
            <option value="inquiry">{t.typeInquiry || "Product Inquiry"}</option>
            <option value="purchase">{t.typePurchase || "Purchase / Order"}</option>
            <option value="support">{t.typeSupport || "Technical Support"}</option>
            <option value="other">{t.typeOther || "Other"}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.subject || "Subject"}</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t.subjectPlaceholder || "Brief description of your request"}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.message || "Message"}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.messagePlaceholder || "Describe your inquiry or request in detail..."}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:border-gray-900"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
            {t.cancel || "Cancel"}
          </button>
          <button
            type="submit"
            disabled={submitting || !subject.trim() || !message.trim()}
            className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300"
          >
            {submitting ? (t.submitting || "Submitting...") : (t.submit || "Submit Ticket")}
          </button>
        </div>
      </form>
    </main>
  );
}
