"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface CompanyContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  isLead: boolean;
  city: string | null;
  country: string | null;
}

interface AllContact {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  companyId: string | null;
}

interface CompanyFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  category: string | null;
  notes: string | null;
  createdAt: string;
}

const FILE_CATEGORY_KEYS = [
  { value: "contract", key: "contract" },
  { value: "proposal", key: "proposal" },
  { value: "invoice", key: "invoice" },
  { value: "report", key: "report" },
  { value: "presentation", key: "presentation" },
  { value: "other", key: "other" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Company {
  id: string;
  name: string;
  website: string;
  industry: string;
  size: string;
  linkedinUrl: string;
  phone: string;
  city: string;
  country: string;
  description: string;
}

const EMPTY: Company = {
  id: "",
  name: "",
  website: "",
  industry: "",
  size: "",
  linkedinUrl: "",
  phone: "",
  city: "",
  country: "",
  description: "",
};

export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const { dict } = useI18n();
  const t = dict.admin?.companies || {};
  const tc = dict.admin?.common || {};

  const [company, setCompany] = useState<Company>(EMPTY);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  // For linking contacts
  const [allContacts, setAllContacts] = useState<AllContact[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");

  // Files / Knowledge Base
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/companies/${id}/files`)
        .then((r) => r.json())
        .then(setFiles)
        .catch(() => {});
    }
  }, [id, isNew]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;

    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);

      const res = await fetch(`/api/admin/companies/${id}/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const record = await res.json();
        setFiles((prev) => [record, ...prev]);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleFileDelete = async (fileId: string) => {
    if (!confirm("Delete this file?")) return;
    const res = await fetch(`/api/admin/files/${fileId}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/companies/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setContacts(data.contacts || []);
          setCompany(data);
          setLoading(false);
        });
    }
  }, [id, isNew]);

  const handleSave = async () => {
    setSaving(true);
    const url = isNew ? "/api/admin/companies" : `/api/admin/companies/${id}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(company),
    });

    if (res.ok) {
      if (isNew) {
        router.push("/admin/companies");
      } else {
        setSaving(false);
      }
    } else {
      setSaving(false);
    }
  };

  // Enrichment
  const [enriching, setEnriching] = useState(false);
  const [enrichData, setEnrichData] = useState<Record<string, string> | null>(null);
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null);

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichMessage(null);
    setEnrichData(null);
    try {
      const url = isNew
        ? `/api/admin/companies/enrich?${new URLSearchParams({
            ...(company.name && { name: company.name }),
            ...(company.website && { website: company.website }),
          })}`
        : `/api/admin/companies/${id}/enrich`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.enrichment) {
          setEnrichData(data.enrichment);
        } else {
          setEnrichMessage(t.enrichNoData || "No additional information available for this company yet.");
        }
      } else {
        setEnrichMessage(t.enrichError || "Unable to reach enrichment service. Please try again.");
      }
    } catch {
      setEnrichMessage(t.enrichError || "Unable to reach enrichment service. Please try again.");
    }
    setEnriching(false);
  };

  const applyEnrichment = (field: string, value: string) => {
    setCompany({ ...company, [field]: value });
    if (enrichData) {
      const next = { ...enrichData };
      delete next[field];
      setEnrichData(Object.keys(next).length > 0 ? next : null);
    }
  };

  const applyAllEnrichment = () => {
    if (!enrichData) return;
    setCompany({ ...company, ...enrichData });
    setEnrichData(null);
  };

  // Link/Unlink contacts
  const openLinkModal = async () => {
    const res = await fetch("/api/admin/contacts");
    if (res.ok) {
      const data = await res.json();
      setAllContacts(data);
    }
    setShowLinkModal(true);
    setLinkSearch("");
  };

  const linkContact = async (contactId: string) => {
    if (!contactId) return;
    await fetch(`/api/admin/contacts/${encodeURIComponent(contactId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: id }),
    });
    // Refresh
    const res = await fetch(`/api/admin/companies/${id}`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data.contacts || []);
    }
    setShowLinkModal(false);
  };

  const unlinkContact = async (contactId: string) => {
    if (!contactId) return;
    await fetch(`/api/admin/contacts/${encodeURIComponent(contactId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: null }),
    });
    setContacts(contacts.filter((c) => c.id !== contactId));
  };

  const handleDelete = async () => {
    if (!confirm(t.deleteConfirm || "Delete this company? Contacts will be unlinked but not deleted.")) return;
    await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
    router.push("/admin/companies");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">{tc.loading || "Loading..."}</p>
      </div>
    );
  }

  const field = (
    label: string,
    key: keyof Company,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={(company[key] as string) || ""}
        onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
        placeholder={placeholder}
      />
    </div>
  );

  const linkedIds = new Set(contacts.map((c) => c.id));
  const filteredLinkContacts = allContacts.filter((c) => {
    if (linkedIds.has(c.id)) return false;
    if (!linkSearch) return true;
    const s = linkSearch.toLowerCase();
    return (
      c.email.toLowerCase().includes(s) ||
      (c.firstName?.toLowerCase() || "").includes(s) ||
      (c.lastName?.toLowerCase() || "").includes(s) ||
      (c.company?.toLowerCase() || "").includes(s)
    );
  });

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/companies"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {t.title || "Companies"}
          </Link>
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? (t.newCompany || "New Company") : company.name || (t.editCompany || "Edit Company")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnrich}
            disabled={enriching || (!company.name && !company.website)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            {enriching ? (tc.saving || "Enriching...") : (t.enrich || "Enrich")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !company.name}
            className="bg-gray-900 text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {saving ? (tc.saving || "Saving...") : isNew ? (tc.create || "Create") : (tc.save || "Save")}
          </button>
        </div>
      </div>

      {/* Enrichment Message */}
      {enrichMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-start justify-between">
          <p className="text-sm text-amber-800">{enrichMessage}</p>
          <button onClick={() => setEnrichMessage(null)} className="text-amber-400 hover:text-amber-600 ml-4 shrink-0">x</button>
        </div>
      )}

      {/* Enrichment Preview */}
      {enrichData && (
        <section className="bg-blue-50 rounded-lg border border-blue-200 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">{t.enrichPreview || "JYTechAI Enrichment Preview"}</h3>
            <div className="flex gap-2">
              <button onClick={applyAllEnrichment} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">{tc.applyAll || "Apply All"}</button>
              <button onClick={() => setEnrichData(null)} className="text-xs text-blue-600 hover:text-blue-800">{tc.dismiss || "Dismiss"}</button>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(enrichData).map(([key, value]) => {
              if (!value) return null;
              const currentVal = String((company as unknown as Record<string, unknown>)[key] ?? "");
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-blue-700 font-medium">{key}</span>
                  <span className="text-gray-500 line-through text-xs">{currentVal || (tc.empty || "empty")}</span>
                  <span className="text-blue-900">{value}</span>
                  {value !== currentVal && (
                    <button onClick={() => applyEnrichment(key, value)} className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto">{tc.apply || "Apply"}</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Company General Info */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.generalInfo || "General Information"}</h3>
          <div className="space-y-4">
            {field(t.companyName || "Company Name", "name", "text", "Acme Corp")}
            {field(t.website || "Website", "website", "url", "https://acme.com")}
            {field(tc.industry || "Industry", "industry", "text", "Manufacturing")}
            {field(t.companySize || "Company Size", "size", "text", "100-500 employees")}
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.contactLocation || "Contact & Location"}</h3>
          <div className="space-y-4">
            {field(tc.phone || "Phone", "phone", "tel", "+1 555 0123")}
            {field(tc.linkedin || "LinkedIn", "linkedinUrl", "url", "https://linkedin.com/company/...")}
            {field(tc.city || "City", "city")}
            {field(tc.country || "Country", "country")}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">{tc.description || "Description"}</h3>
        <textarea
          value={company.description || ""}
          onChange={(e) => setCompany({ ...company, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
          placeholder={t.descriptionPlaceholder || "Brief description of the company..."}
        />
      </section>

      {/* Employee Contacts & POC */}
      {!isNew && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t.people || "People"}</h3>
              <p className="text-xs text-gray-500">{(t.contactsLinked || "{count} contacts linked to this company").replace("{count}", String(contacts.length))}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/crm/new`}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {t.newContactLink || "+ New Contact"}
              </Link>
              <button
                onClick={openLinkModal}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 font-medium transition-colors"
              >
                {t.linkExisting || "Link Existing"}
              </button>
            </div>
          </div>

          {contacts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {t.noContactsLinked || "No contacts linked yet. Link existing contacts or create new ones."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 pr-3 font-medium text-gray-600">{t.tableContactName || "Name"}</th>
                    <th className="pb-2 pr-3 font-medium text-gray-600">{t.tableContactTitle || "Title"}</th>
                    <th className="pb-2 pr-3 font-medium text-gray-600">{t.tableContactEmail || "Email"}</th>
                    <th className="pb-2 pr-3 font-medium text-gray-600">{t.tableContactPhone || "Phone"}</th>
                    <th className="pb-2 pr-3 font-medium text-gray-600">{t.tableContactStatus || "Status"}</th>
                    <th className="pb-2 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((c) => {
                    const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-3">
                          <Link href={`/admin/crm/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                            {name || "—"}
                          </Link>
                          {c.city && c.country && (
                            <div className="text-xs text-gray-400">{c.city}, {c.country}</div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-600">
                          {c.jobTitle || "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          <a href={`mailto:${c.email}`} className="text-blue-600 hover:text-blue-800 text-xs">
                            {c.email}
                          </a>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-600 text-xs">
                          {c.phone || "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex gap-1">
                            {c.isLead && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{tc.lead || "Lead"}</span>
                            )}
                            {c.linkedinUrl && (
                              <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100">
                                {tc.linkedin || "LinkedIn"}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => unlinkContact(c.id)}
                            className="text-xs text-gray-400 hover:text-red-600"
                            title={t.unlinkFromCompany || "Unlink from company"}
                          >
                            {t.unlink || "Unlink"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Knowledge Base / Files */}
      {!isNew && (
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{t.knowledgeBase || "Knowledge Base"}</h3>
              <p className="text-xs text-gray-500">{(t.filesCount || "{count} files").replace("{count}", String(files.length))}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gray-900"
              >
                {FILE_CATEGORY_KEYS.map((c) => (
                  <option key={c.value} value={c.value}>{t[c.key] || c.key}</option>
                ))}
              </select>
              <label className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded cursor-pointer hover:bg-gray-800 transition-colors font-medium">
                {uploading ? (tc.uploading || "Uploading...") : (t.uploadFile || "Upload File")}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {files.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {t.noFiles || "No files yet. Upload contracts, proposals, reports, and more."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 pr-3 font-medium text-gray-600">{tc.file || "File"}</th>
                    <th className="pb-2 pr-3 font-medium text-gray-600">{tc.category || "Category"}</th>
                    <th className="pb-2 pr-3 font-medium text-gray-600">{tc.size || "Size"}</th>
                    <th className="pb-2 pr-3 font-medium text-gray-600">{tc.date || "Date"}</th>
                    <th className="pb-2 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {files.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-3">
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {f.name}
                        </a>
                        <div className="text-xs text-gray-400">{f.mimeType}</div>
                      </td>
                      <td className="py-2.5 pr-3">
                        {f.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                            {f.category}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatFileSize(f.size)}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleFileDelete(f.id)}
                          className="text-xs text-gray-400 hover:text-red-600"
                        >
                          {tc.delete || "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Footer Actions */}
      {!isNew && (
        <div className="flex items-center justify-end">
          <button
            onClick={handleDelete}
            className="text-sm text-red-600 hover:text-red-800"
          >
            {t.deleteCompany || "Delete Company"}
          </button>
        </div>
      )}

      {/* Link Contact Modal — rendered via portal to avoid z-index/overflow issues */}
      {showLinkModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{t.linkContact || "Link Contact"}</h3>
                <button onClick={() => setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600">x</button>
              </div>
              <input
                type="text"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                placeholder={t.searchContacts || "Search by name, email, or company..."}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {filteredLinkContacts.length === 0 ? (
                <p className="text-sm text-gray-500 p-4 text-center">{t.noMatchingContacts || "No matching contacts found."}</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredLinkContacts.slice(0, 20).map((c) => {
                    const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => linkContact(c.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 text-sm transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                      >
                        <div className="font-medium text-gray-900">{name || c.email}</div>
                        <div className="text-xs text-gray-500">
                          {c.email}
                          {c.company && ` — ${c.company}`}
                          {c.companyId && c.companyId !== id && (
                            <span className="text-amber-600 ml-1">{t.linkedToAnother || "(linked to another company)"}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
