"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { dict, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const t = dict.nav;

  function switchLocale() {
    const newLocale = locale === "en" ? "zh" : "en";
    setLocale(newLocale);

    // Navigate between /blog and /en/blog paths
    if (pathname.startsWith("/en/blog")) {
      router.push(pathname.replace(/^\/en\/blog/, "/blog"));
    } else if (pathname.startsWith("/blog")) {
      router.push(`/en${pathname}`);
    }
  }

  const NAV_ITEMS = [
    { href: "/#products", label: t.products },
    { href: "/#features", label: t.features },
    { href: "/#scenarios", label: t.scenarios },
    { href: "/#cases", label: t.cases },
    { href: "/#specs", label: t.specs },
    { href: "/#platform", label: t.platform },
    { href: "/blog", label: t.blog },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="bg-accent h-1" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              SIENOVO
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-accent transition-colors"
              >
                {item.label}
              </a>
            ))}
            {/* Language Switcher */}
            <button
              onClick={switchLocale}
              className="px-2 py-1 rounded border border-gray-200 text-xs font-semibold text-gray-500 hover:text-accent hover:border-accent transition-colors"
            >
              {locale === "en" ? "中文" : "EN"}
            </button>
            <a
              href="/login"
              className="bg-accent text-white px-5 py-2 rounded hover:bg-red-700 transition-colors"
            >
              {t.login || "Login"}
            </a>
          </nav>
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block py-2 text-sm font-medium text-gray-600 hover:text-accent"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <button
              onClick={() => { switchLocale(); setOpen(false); }}
              className="block w-full text-left py-2 text-sm font-medium text-gray-600 hover:text-accent"
            >
              {locale === "en" ? "中文" : "English"}
            </button>
            <a
              href="/login"
              className="block mt-2 text-center bg-accent text-white px-5 py-2 rounded hover:bg-red-700 transition-colors text-sm font-medium"
              onClick={() => setOpen(false)}
            >
              {t.login || "Login"}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
