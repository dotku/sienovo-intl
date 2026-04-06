"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { GoogleSyncButton, BrevoSyncButton, ApolloEnrichButton } from "./SyncButtons";

interface ContactRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  message: string | null;
  source: string | null;
  isLead: boolean;
  isNewsletter: boolean;
  linkedinUrl: string | null;
}

export default function CRMContactsList({
  contacts,
  googleConnected,
  googleParam,
  errorParam,
}: {
  contacts: ContactRow[];
  googleConnected: boolean;
  googleParam?: string;
  errorParam?: string;
}) {
  const { dict } = useI18n();
  const t = dict.admin?.crm || {};
  const tc = dict.admin?.common || {};

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {googleParam === "connected" && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          {t.googleConnected || "Google account connected successfully. You can now sync contacts."}
        </div>
      )}
      {errorParam && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {t.googleFailed || "Failed to connect Google account. Please try again."}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t.contactsAndLeads || "Contacts & Leads"}
          </h2>
          <p className="text-sm text-gray-500">
            {(t.contactsCount || "{count} contacts").replace("{count}", String(contacts.length))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/admin/crm/new"
            className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {t.addContact || "Add Contact"}
          </Link>
          <GoogleSyncButton connected={googleConnected} />
          <BrevoSyncButton />
          <ApolloEnrichButton />
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">{t.noContacts || "No contacts yet."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableContact || "Contact"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableCompany || "Company"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableTitle || "Title"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableSource || "Source"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableMessage || "Message"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableLinks || "Links"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts.map((contact) => {
                  const name = [contact.firstName, contact.lastName]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/crm/${contact.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {name || "—"}
                        </Link>
                        <div className="text-gray-500 text-xs">
                          {contact.email}
                        </div>
                        {contact.city && contact.country && (
                          <div className="text-gray-400 text-xs mt-0.5">
                            {contact.city}, {contact.country}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">
                          {contact.company || "—"}
                        </div>
                        {contact.industry && (
                          <div className="text-gray-400 text-xs">
                            {contact.industry}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {contact.jobTitle || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {contact.isLead && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {tc.lead || "Lead"}
                            </span>
                          )}
                          {contact.isNewsletter && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              {tc.newsletter || "Newsletter"}
                            </span>
                          )}
                          {contact.source && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {contact.source}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-gray-600 text-xs truncate">
                          {contact.message || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {contact.linkedinUrl && (
                          <Link
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            {tc.linkedin || "LinkedIn"}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/crm/${contact.id}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          {tc.edit || "Edit"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
