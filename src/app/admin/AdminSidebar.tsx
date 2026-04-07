"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
  children?: { href: string; labelKey: string }[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/chat",
    labelKey: "aiChat",
    icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
  },
  {
    href: "/admin/tickets",
    labelKey: "tickets",
    icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z",
  },
  {
    href: "/admin",
    labelKey: "products",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    href: "/admin/system",
    labelKey: "system",
    icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    children: [
      { href: "/admin/system/knowledge", labelKey: "knowledgeBase" },
      { href: "/admin/system/articles", labelKey: "articles" },
      { href: "/admin/system/usage", labelKey: "apiUsage" },
      { href: "/admin/team", labelKey: "team" },
    ],
  },
  {
    href: "/admin/crm",
    labelKey: "crm",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    children: [
      { href: "/admin/crm", labelKey: "contacts" },
      { href: "/admin/companies", labelKey: "companies" },
    ],
  },
  {
    href: "/admin/outreach",
    labelKey: "outreach",
    icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
    children: [
      { href: "/admin/outreach", labelKey: "campaigns" },
      { href: "/admin/outreach/emails", labelKey: "emailQueue" },
      { href: "/admin/outreach/social", labelKey: "socialSearch" },
    ],
  },
];

export default function AdminSidebar({ email }: { email: string }) {
  const { dict, locale, setLocale } = useI18n();
  const t = dict.admin?.nav || {};

  return (
    <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-800">
        <Link href="/admin" className="text-lg font-bold text-white">
          {dict.admin?.title || "Sienovo Admin"}
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <div key={item.href}>
            {item.children ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400">
                  <svg
                    className="w-5 h-5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={item.icon}
                    />
                  </svg>
                  {t[item.labelKey] || item.labelKey}
                </div>
                <div className="ml-8 space-y-0.5">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-3 py-1.5 rounded text-sm hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      {t[child.labelKey] || child.labelKey}
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded text-sm font-medium hover:bg-gray-800 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={item.icon}
                  />
                </svg>
                {t[item.labelKey] || item.labelKey}
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-800 text-xs space-y-2">
        <p className="text-gray-500 truncate">{email}</p>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors"
          >
            {t.site || "Site"}
          </Link>
          <a
            href="/auth/logout"
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            {t.logout || "Logout"}
          </a>
          <button
            onClick={() => setLocale(locale === "en" ? "zh" : "en")}
            className="ml-auto text-gray-400 hover:text-white transition-colors"
          >
            {locale === "en" ? "中文" : "EN"}
          </button>
        </div>
      </div>
    </aside>
  );
}
