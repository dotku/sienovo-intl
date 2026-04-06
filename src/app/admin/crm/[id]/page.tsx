"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface Contact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  industry: string;
  phone: string;
  linkedinUrl: string;
  city: string;
  country: string;
  message: string;
  source: string;
  isLead: boolean;
  isNewsletter: boolean;
}

const EMPTY: Contact = {
  id: "",
  email: "",
  firstName: "",
  lastName: "",
  company: "",
  jobTitle: "",
  industry: "",
  phone: "",
  linkedinUrl: "",
  city: "",
  country: "",
  message: "",
  source: "",
  isLead: true,
  isNewsletter: false,
};

export default function EditContactPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const { dict } = useI18n();
  const t = dict.admin?.crm || {};
  const tc = dict.admin?.common || {};

  const [contact, setContact] = useState<Contact>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/contacts/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error("Not found");
          return r.json();
        })
        .then((data) => {
          setContact(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id, isNew]);

  const handleSave = async () => {
    setSaving(true);
    const url = isNew ? "/api/admin/contacts" : `/api/admin/contacts/${id}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contact, companyId: companyId || null }),
    });

    if (res.ok) {
      router.push("/admin/crm");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(t.deleteConfirm || "Delete this contact?")) return;
    await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
    router.push("/admin/crm");
  };

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data));
  }, []);

  useEffect(() => {
    if (!isNew && contact.id) {
      fetch(`/api/admin/contacts/${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.companyId) setCompanyId(data.companyId);
        })
        .catch(() => {});
    }
  }, [contact.id, id, isNew]);

  const [enriching, setEnriching] = useState(false);
  const [enrichData, setEnrichData] = useState<Record<string, string> | null>(null);
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null);

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichMessage(null);
    setEnrichData(null);
    try {
      const params = new URLSearchParams();
      if (contact.email) params.set("email", contact.email);
      if (contact.firstName) params.set("firstName", contact.firstName);
      if (contact.lastName) params.set("lastName", contact.lastName);
      if (contact.company) params.set("company", contact.company);
      const url = isNew || !contact.email
        ? `/api/admin/contacts/enrich-email?${params}`
        : `/api/admin/contacts/${id}/enrich`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.enrichment) {
          setEnrichData(data.enrichment);
        } else {
          setEnrichMessage(t.enrichNoData || "No additional information available for this contact yet. Our data sources are continuously updated — try again later.");
        }
      } else {
        setEnrichMessage(t.enrichError || "Unable to reach enrichment service. Please try again in a moment.");
      }
    } catch {
      setEnrichMessage(t.enrichError || "Unable to reach enrichment service. Please try again in a moment.");
    }
    setEnriching(false);
  };

  const applyEnrichment = (field: string, value: string) => {
    setContact({ ...contact, [field]: value });
    if (enrichData) {
      const next = { ...enrichData };
      delete next[field];
      setEnrichData(Object.keys(next).length > 0 ? next : null);
    }
  };

  const applyAllEnrichment = () => {
    if (!enrichData) return;
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(enrichData)) {
      if (value) updates[key] = value;
    }
    setContact({ ...contact, ...updates });
    setEnrichData(null);
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
    key: keyof Contact,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={(contact[key] as string) || ""}
        onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {isNew ? (t.newContact || "New Contact") : (t.editContact || "Edit Contact")}
        </h2>
        <Link
          href="/admin/crm"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          {tc.back || "Back"}
        </Link>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">{t.contactInfo || "Contact Info"}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {field(tc.email || "Email", "email", "email", "john@company.com")}
          {field(tc.phone || "Phone", "phone", "tel", "+1 555 0123")}
          {field(t.firstName || "First Name", "firstName", "text", "John")}
          {field(t.lastName || "Last Name", "lastName", "text", "Smith")}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">{tc.company || "Company"}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {field(tc.company || "Company", "company", "text", "Acme Corp")}
          {field(t.jobTitle || "Job Title", "jobTitle", "text", "VP Engineering")}
          {field(tc.industry || "Industry", "industry", "text", "Manufacturing")}
          {field(t.linkedinUrl || "LinkedIn", "linkedinUrl", "url", "https://linkedin.com/in/...")}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.linkToCompany || "Link to Company"}
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
            >
              <option value="">{tc.noNone || "— None —"}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">{t.location || "Location"}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {field(tc.city || "City", "city")}
          {field(tc.country || "Country", "country")}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">{tc.status || "Status"}</h3>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={contact.isLead}
              onChange={(e) =>
                setContact({ ...contact, isLead: e.target.checked })
              }
              className="rounded"
            />
            {t.leadCheckbox || "Lead"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={contact.isNewsletter}
              onChange={(e) =>
                setContact({ ...contact, isNewsletter: e.target.checked })
              }
              className="rounded"
            />
            {t.newsletterCheckbox || "Newsletter Subscriber"}
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.messageNotes || "Message / Notes"}
          </label>
          <textarea
            value={contact.message || ""}
            onChange={(e) =>
              setContact({ ...contact, message: e.target.value })
            }
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
          />
        </div>
      </section>

      {enrichMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 flex items-start justify-between">
          <p className="text-sm text-amber-800">{enrichMessage}</p>
          <button
            onClick={() => setEnrichMessage(null)}
            className="text-amber-400 hover:text-amber-600 ml-4 shrink-0"
          >
            x
          </button>
        </div>
      )}

      {enrichData && (
        <section className="bg-blue-50 rounded-lg border border-blue-200 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">
              {t.enrichPreview || "JYTechAI Enrichment Preview"}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={applyAllEnrichment}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                {tc.applyAll || "Apply All"}
              </button>
              <button
                onClick={() => setEnrichData(null)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {tc.dismiss || "Dismiss"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(enrichData).map(([key, value]) => {
              if (!value) return null;
              const currentVal = String((contact as unknown as Record<string, unknown>)[key] ?? "");
              const changed = value !== currentVal;
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-28 shrink-0 text-blue-700 font-medium">
                    {key}
                  </span>
                  <span className="text-gray-500 line-through text-xs">
                    {currentVal || (tc.empty || "empty")}
                  </span>
                  <span className="text-blue-900">{value}</span>
                  {changed && (
                    <button
                      onClick={() => applyEnrichment(key, value)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-auto"
                    >
                      {tc.apply || "Apply"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="text-sm text-red-600 hover:text-red-800"
            >
              {t.deleteContact || "Delete Contact"}
            </button>
          )}
          <button
            onClick={handleEnrich}
            disabled={enriching || (!contact.email && !contact.firstName && !contact.lastName)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            {enriching ? (t.enriching || "Enriching...") : (t.enrichWith || "Enrich with JYTechAI")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400">
            {t.saveSyncHint || "Saves to database, syncs to Google & email service"}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 text-white px-6 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {saving
              ? (tc.saving || "Saving...")
              : isNew
                ? (t.createContact || "Create Contact")
                : (t.saveSync || "Save & Sync")}
          </button>
        </div>
      </div>
    </main>
  );
}
