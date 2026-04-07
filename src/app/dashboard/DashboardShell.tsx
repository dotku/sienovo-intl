"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    labelKey: "overview",
    icon: "M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  },
  {
    href: "/dashboard/orders",
    labelKey: "myOrders",
    icon: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
  },
  {
    href: "/dashboard/tickets",
    labelKey: "myTickets",
    icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z",
  },
  {
    href: "/dashboard/chat",
    labelKey: "aiAssistant",
    icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
  },
  {
    href: "/dashboard/contact",
    labelKey: "contactUs",
    icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  },
  {
    href: "/dashboard/profile",
    labelKey: "profile",
    icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  },
];

const defaultLabels: Record<string, string> = {
  overview: "Overview",
  myOrders: "My Orders",
  myTickets: "My Tickets",
  aiAssistant: "AI Assistant",
  contactUs: "Contact Us",
  profile: "Profile",
};

export default function DashboardShell({
  email,
  name,
  children,
}: {
  email: string;
  name: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { dict, locale, setLocale } = useI18n();
  const t = dict.dashboard?.nav || {};

  const initials = (name || email || "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sidebar = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <span className="text-base font-bold text-white">Sienovo</span>
            <p className="text-[10px] text-gray-500 leading-none">{t.portal || "Customer Portal"}</p>
          </div>
        </Link>
        {/* Close on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1 text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              <svg
                className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {t[item.labelKey] || defaultLabels[item.labelKey]}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white truncate">{name || email}</p>
            {name && (
              <p className="text-[11px] text-gray-500 truncate">{email}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            {locale === "en" ? "中文" : "EN"}
          </button>
          <span className="text-gray-700">|</span>
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">
            {t.site || "Home"}
          </Link>
          <span className="text-gray-700">|</span>
          <a href="/auth/logout" className="text-gray-500 hover:text-gray-300 transition-colors">
            {t.logout || "Logout"}
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop: fixed, mobile: slide-over */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-60 bg-gray-900 text-gray-300 flex flex-col transition-transform duration-200 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <div className="md:ml-60 min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <Link href="/dashboard" className="font-bold text-gray-900">
            Sienovo
          </Link>
        </div>

        {/* Page content */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
