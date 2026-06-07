"use client";

import { useState } from "react";

export interface ContactFormLabels {
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  send: string;
  sending: string;
  success: string;
  error: string;
  optional: string;
}

export default function ContactForm({ t }: { t: ContactFormLabels }) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setForm({ name: "", email: "", company: "", phone: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-green-800">
        {t.success}
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t.name}</label>
          <input className={field} value={form.name} onChange={set("name")} autoComplete="name" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t.email} <span className="text-red-500">*</span>
          </label>
          <input type="email" required className={field} value={form.email} onChange={set("email")} autoComplete="email" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t.company} <span className="text-gray-400">({t.optional})</span>
          </label>
          <input className={field} value={form.company} onChange={set("company")} autoComplete="organization" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t.phone} <span className="text-gray-400">({t.optional})</span>
          </label>
          <input className={field} value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t.message} <span className="text-red-500">*</span>
        </label>
        <textarea required rows={5} className={field} value={form.message} onChange={set("message")} />
      </div>
      {status === "error" && <p className="text-sm text-red-600">{t.error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "sending" ? t.sending : t.send}
      </button>
    </form>
  );
}
