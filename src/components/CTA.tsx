"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export default function CTA() {
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
          message: formData.get("message"),
        }),
      });
      if (res.ok) { setStatus("success"); form.reset(); }
      else { setStatus("error"); }
    } catch { setStatus("error"); }
  };

  return (
    <section id="contact" className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.title}</h2>
        <p className="text-lg text-gray-300 mb-8">{t.subtitle}</p>
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
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">{t.messageLabel}</label>
                <textarea id="message" name="message" rows={3} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-accent" placeholder={t.messagePlaceholder} />
              </div>
              <button type="submit" disabled={status === "loading"} className="w-full bg-accent hover:bg-red-700 disabled:bg-accent/50 text-white py-3 rounded font-medium transition-colors">
                {status === "loading" ? t.sending : t.submit}
              </button>
              {status === "error" && <p className="text-red-400 text-sm text-center">{t.errorMessage}</p>}
            </form>
          )}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="https://calendly.com/sienovoleo" target="_blank" rel="noopener noreferrer" className="bg-white text-gray-900 px-6 py-3 rounded font-medium hover:bg-gray-100 transition-colors text-sm">
            {t.scheduleDemo}
          </a>
          <span className="text-gray-500 text-sm">or</span>
          <a href="mailto:leo.liu@jytech.us" className="text-accent hover:underline text-sm">leo.liu@jytech.us</a>
        </div>
      </div>
    </section>
  );
}
