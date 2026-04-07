"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

export default function AccessDenied({ email }: { email: string }) {
  const { dict } = useI18n();
  const t = dict.admin?.accessDenied || {};

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          {t.title || "Access Denied"}
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          {t.loggedInAs || "You are logged in as"} <strong>{email}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          {t.noAccess || "This account does not have admin access."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
            {t.backToSite || "Back to Site"}
          </Link>
          <a href="/auth/logout" className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800">
            {t.logout || "Logout"}
          </a>
        </div>
      </div>
    </div>
  );
}
