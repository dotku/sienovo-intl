"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

// variant="x300": camera-specific inquiry (title, company + order type), used on the VisionInt X300 page.
export default function CTA({ variant }: { variant?: "x300" } = {}) {
  const x300 = variant === "x300";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const { dict } = useI18n();
  const t = dict.cta;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          message: x300
            ? [
                "[Product: VisionInt X300]",
                `Company: ${formData.get("company") || "-"}`,
                `Order type: ${formData.get("orderType") || "-"}`,
                "",
                String(formData.get("message") || ""),
              ].join("\n")
            : formData.get("message"),
        }),
      });
      if (res.ok) { setStatus("success"); form.reset(); }
      else { setStatus("error"); }
    } catch { setStatus("error"); }
  };

  return (
    <section id="contact" className={`py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white ${x300 ? "scroll-mt-28" : ""}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">{x300 ? "Get X300 pricing for your brand" : t.title}</h2>
        <p className="text-lg text-gray-300 mb-8">
          {x300
            ? "Tell us your market, order type and estimated volume. We reply with pricing, MOQ and lead time."
            : t.subtitle}
        </p>
        <div className="bg-gray-800 rounded-lg p-8 text-left max-w-md mx-auto">
          {status === "success" ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">&#10003;</div>
              <h3 className="text-lg font-bold text-white mb-2">{t.successTitle}</h3>
              <p className="text-gray-300 text-sm">{t.successMessage}</p>
              <button onClick={() => setStatus("idle")} className="mt-4 text-accent hover:underline text-sm">
                {t.sendAnother}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">{t.nameLabel}</label>
                <input type="text" id="name" name="name" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent" placeholder={t.namePlaceholder} />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">{t.emailLabel}</label>
                <input type="email" id="email" name="email" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent" placeholder={t.emailPlaceholder} />
              </div>
              {x300 && (
                <>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-1">Company</label>
                    <input type="text" id="company" name="company" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent" placeholder="Company name" />
                  </div>
                  <div>
                    <label htmlFor="orderType" className="block text-sm font-medium text-gray-300 mb-1">Order type</label>
                    <select id="orderType" name="orderType" defaultValue="Wholesale" className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-accent">
                      <option>Wholesale</option>
                      <option>OEM private label</option>
                      <option>ODM customization</option>
                      <option>Not sure yet</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">{t.messageLabel}</label>
                <textarea id="message" name="message" rows={3} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent" placeholder={x300 ? "Target market, estimated quantity, timeline..." : t.messagePlaceholder} />
              </div>
              <button type="submit" disabled={status === "loading"} className="w-full bg-accent hover:bg-red-700 disabled:bg-accent/50 text-white py-3 rounded font-medium transition-colors">
                {status === "loading" ? t.sending : t.submit}
              </button>
              {status === "error" && <p className="text-red-400 text-sm text-center">{t.errorMessage}</p>}
            </form>
          )}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          {!x300 && (
            <>
              <a href="https://calendly.com/sienovo" target="_blank" rel="noopener noreferrer" className="bg-white text-gray-900 px-6 py-3 rounded font-medium hover:bg-gray-100 transition-colors text-sm">
                {t.scheduleDemo}
              </a>
              <span className="text-gray-500 text-sm">or</span>
            </>
          )}
          <a href="mailto:collin.liu@sienovo.cn" className="text-accent hover:underline text-sm">collin.liu@sienovo.cn</a>
        </div>
      </div>
    </section>
  );
}
