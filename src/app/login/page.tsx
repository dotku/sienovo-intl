"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

export default function LoginPage() {
  const { dict, locale, setLocale } = useI18n();
  const t = dict.login ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tight text-white">
          SIENOVO
        </Link>
        <button
          onClick={() => setLocale(locale === "en" ? "zh" : "en")}
          className="px-2.5 py-1 rounded border border-gray-600 text-xs font-semibold text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
        >
          {locale === "en" ? "中文" : "EN"}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gray-900 px-8 py-8 text-center">
              <h1 className="text-2xl font-bold text-white mb-2">
                {t.welcome || "Welcome to Sienovo"}
              </h1>
              <p className="text-sm text-gray-400">
                {t.subtitle || "Sign in to access your dashboard, manage tickets, and explore AI-powered tools."}
              </p>
            </div>

            {/* Actions */}
            <div className="px-8 py-8 space-y-4">
              {/* Sign In */}
              <a
                href="/auth/login?returnTo=/dashboard"
                className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-red-700 text-white px-6 py-3.5 rounded-lg font-semibold transition-colors text-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                {t.signIn || "Sign In"}
              </a>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 uppercase">
                  {t.or || "or"}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Create Account */}
              <a
                href="/auth/login?screen_hint=signup&returnTo=/dashboard"
                className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 hover:border-accent text-gray-700 hover:text-accent px-6 py-3.5 rounded-lg font-semibold transition-colors text-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                </svg>
                {t.createAccount || "Create Account"}
              </a>
            </div>

            {/* Features list */}
            <div className="px-8 pb-8">
              <div className="bg-gray-50 rounded-lg p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t.benefits || "What you get"}
                </p>
                <ul className="space-y-2.5">
                  {(t.benefitItems || [
                    "Personal dashboard with AI assistant",
                    "Submit and track support tickets",
                    "Access product documentation & specs",
                    "Get exclusive updates and pricing",
                  ]).map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Back to home */}
          <div className="text-center mt-6">
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              {t.backToHome || "Back to Homepage"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
