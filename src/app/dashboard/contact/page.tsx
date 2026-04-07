"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

export default function ContactPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { dict } = useI18n();
  const t = dict.dashboard?.contact || {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);

    const res = await fetch("/api/dashboard/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, type: "support", message }),
    });

    if (res.ok) setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">&#9989;</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{t.sent || "Message Sent"}</h2>
          <p className="text-sm text-gray-500 mb-6">{t.sentDesc || "We'll get back to you as soon as possible."}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => router.push("/dashboard/tickets")} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800">
              {t.viewTickets || "View My Tickets"}
            </button>
            <button onClick={() => { setSubmitted(false); setSubject(""); setMessage(""); }} className="text-sm text-gray-500 hover:text-gray-700">
              {t.sendAnother || "Send Another"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">{t.title || "Contact Us"}</h2>

      <div className="grid gap-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <a href="https://calendly.com/sienovo" target="_blank" rel="noopener noreferrer"
            className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <h3 className="font-semibold text-gray-900 text-sm">{t.bookDemo || "Book a Demo"}</h3>
            <p className="text-xs text-gray-500 mt-1">{t.bookDemoDesc || "Schedule a live product demonstration"}</p>
          </a>
          <a href="mailto:sienovoleo@gmail.com" className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <h3 className="font-semibold text-gray-900 text-sm">{t.emailUs || "Email Us"}</h3>
            <p className="text-xs text-gray-500 mt-1">sienovoleo@gmail.com</p>
          </a>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">{t.sendMessage || "Send a Message"}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.subject || "Subject"}</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder={t.subjectPlaceholder || "What can we help with?"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.message || "Message"}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePlaceholder || "Describe your question or request..."}
              rows={5} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:border-gray-900" required />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300">
            {submitting ? (t.sending || "Sending...") : (t.send || "Send Message")}
          </button>
        </form>
      </div>
    </main>
  );
}
