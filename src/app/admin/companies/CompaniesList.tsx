"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  city: string | null;
  country: string | null;
  linkedinUrl: string | null;
  _count: { contacts: number };
}

export default function CompaniesList({ companies }: { companies: CompanyRow[] }) {
  const { dict } = useI18n();
  const t = dict.admin?.companies || {};
  const tc = dict.admin?.common || {};

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t.title || "Companies"}</h2>
          <p className="text-sm text-gray-500">
            {(t.companiesCount || "{count} companies").replace("{count}", String(companies.length))}
          </p>
        </div>
        <Link
          href="/admin/companies/new"
          className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          {t.addCompany || "Add Company"}
        </Link>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">{t.noCompanies || "No companies yet."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableCompany || "Company"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableIndustry || "Industry"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableSize || "Size"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableLocation || "Location"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableContacts || "Contacts"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700">{t.tableLinks || "Links"}</th>
                  <th className="px-4 py-3 font-medium text-gray-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map((company) => {
                  const location = [company.city, company.country]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/companies/${company.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {company.name}
                        </Link>
                        {company.website && (
                          <a
                            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 text-xs hover:text-blue-600 block"
                          >
                            {company.website}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{company.industry || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{company.size || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{location || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                          {company._count.contacts}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {company.linkedinUrl && (
                          <a
                            href={company.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            {tc.linkedin || "LinkedIn"}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/companies/${company.id}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          {t.view || "View"}
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
