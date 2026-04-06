"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface EmailRecord {
  id: string;
  status: string;
  subject: string;
  htmlContent: string;
  sentAt: string | null;
  error: string | null;
  step: { stepOrder: number };
  contact: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    jobTitle: string | null;
  };
  campaign: { name: string };
}

const STATUS_OPTIONS = ["draft", "approved", "pending", "sent", "failed", "skipped"];

export default function EmailQueuePage() {
  const searchParams = useSearchParams();
  const { dict } = useI18n();
  const t = dict.admin?.outreach || {};
  const tc = dict.admin?.common || {};

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(searchParams.get("status") || "draft");
  const [campaignId] = useState(searchParams.get("campaignId") || "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState("");

  const fetchEmails = async (status?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (campaignId) params.set("campaignId", campaignId);
    if (status || filter) params.set("status", status || filter);
    const res = await fetch(`/api/admin/outreach/emails?${params}`);
    if (res.ok) setEmails(await res.json());
    setLoading(false);
    setSelected(new Set());
  };

  useEffect(() => {
    fetchEmails();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const showAlert = (msg: string) => {
    setAlert(msg);
    setTimeout(() => setAlert(""), 3000);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === emails.length) setSelected(new Set());
    else setSelected(new Set(emails.map((e) => e.id)));
  };

  const bulkAction = async (action: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await fetch("/api/admin/outreach/emails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailIds: ids, action }),
    });
    showAlert(`${action} ${ids.length} emails`);
    fetchEmails();
  };

  const startEdit = (e: EmailRecord) => {
    setEditingId(e.id);
    setEditSubject(e.subject);
    setEditHtml(e.htmlContent);
    setExpandedId(e.id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch("/api/admin/outreach/emails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId: editingId, subject: editSubject, htmlContent: editHtml }),
    });
    setEditingId(null);
    showAlert(t.saved || "Saved!");
    fetchEmails();
  };

  const approveAndSave = async () => {
    if (!editingId) return;
    await fetch("/api/admin/outreach/emails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId: editingId, subject: editSubject, htmlContent: editHtml, status: "approved" }),
    });
    setEditingId(null);
    showAlert(t.approvedAndSaved || "Approved & Saved!");
    fetchEmails();
  };

  const handleSend = async () => {
    setSending(true);
    const body: Record<string, unknown> = {};
    if (selected.size > 0) body.emailIds = Array.from(selected);
    else if (campaignId) body.campaignId = campaignId;
    else {
      // Send all approved visible
      body.emailIds = emails.filter((e) => e.status === "approved").map((e) => e.id);
    }

    const res = await fetch("/api/admin/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      showAlert(`${t.sent || "Sent"}: ${data.sent}${data.failed ? `, ${t.failed || "Failed"}: ${data.failed}` : ""}`);
      fetchEmails();
    }
    setSending(false);
  };

  const approvedCount = emails.filter((e) => e.status === "approved").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t.emailQueue || "Email Queue"}</h1>
          <Link href="/admin/outreach" className="text-sm text-gray-500 hover:text-gray-900">
            {tc.back || "Back"}
          </Link>
        </div>
      </header>

      {alert && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-sm text-green-700">{alert}</div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  filter === s ? "bg-gray-900 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {selected.size > 0 && filter === "draft" && (
            <button
              onClick={() => bulkAction("approve")}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              {t.approveSelected || "Approve"} ({selected.size})
            </button>
          )}
          {selected.size > 0 && (
            <button
              onClick={() => bulkAction("skip")}
              className="bg-gray-400 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-500 transition-colors"
            >
              {t.skip || "Skip"} ({selected.size})
            </button>
          )}
          {selected.size > 0 && (
            <button
              onClick={() => bulkAction("regenerate")}
              className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-purple-700 transition-colors"
            >
              {t.regenerate || "Regenerate"} ({selected.size})
            </button>
          )}
          {(approvedCount > 0 || (selected.size > 0 && filter === "approved")) && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-green-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-green-700 disabled:bg-green-300 transition-colors"
            >
              {sending ? (t.sendingEmails || "Sending...") : `${t.sendApproved || "Send"} (${selected.size > 0 ? selected.size : approvedCount})`}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-16">{tc.loading || "Loading..."}</p>
        ) : emails.length === 0 ? (
          <p className="text-center text-gray-500 py-16">{t.noEmails || "No emails with this status"}</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
              <input type="checkbox" onChange={selectAll} checked={selected.size === emails.length && emails.length > 0} />
              <span className="w-48">{t.contact || "Contact"}</span>
              <span className="w-24">{t.campaign || "Campaign"}</span>
              <span className="w-12 text-center">{t.step || "Step"}</span>
              <span className="flex-1">{t.subject || "Subject"}</span>
              <span className="w-20">{t.status || "Status"}</span>
              <span className="w-20 text-right">{t.actions || "Actions"}</span>
            </div>

            {emails.map((e) => (
              <div key={e.id}>
                <div
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={(ev) => { ev.stopPropagation(); toggleSelect(e.id); }}
                    onClick={(ev) => ev.stopPropagation()}
                  />
                  <div className="w-48 truncate">
                    <span className="font-medium text-gray-900">
                      {e.contact.firstName} {e.contact.lastName}
                    </span>
                    <span className="text-gray-400 text-xs ml-1">{e.contact.company}</span>
                  </div>
                  <span className="w-24 text-xs text-gray-500 truncate">{e.campaign.name}</span>
                  <span className="w-12 text-center text-xs text-gray-500">#{e.step.stepOrder}</span>
                  <span className="flex-1 text-gray-700 truncate">{e.subject || "-"}</span>
                  <span className={`w-20 px-1.5 py-0.5 rounded text-xs font-medium text-center ${
                    e.status === "sent" ? "bg-green-100 text-green-700" :
                    e.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                    e.status === "approved" ? "bg-blue-100 text-blue-700" :
                    e.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {e.status}
                  </span>
                  <div className="w-20 text-right">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); startEdit(e); }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {tc.edit || "Edit"}
                    </button>
                  </div>
                </div>

                {/* Expanded Preview/Edit */}
                {expandedId === e.id && (
                  <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                    {editingId === e.id ? (
                      <div className="space-y-3 pt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t.subject || "Subject"}</label>
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(ev) => setEditSubject(ev.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t.htmlContent || "Email Body (HTML)"}</label>
                          <textarea
                            value={editHtml}
                            onChange={(ev) => setEditHtml(ev.target.value)}
                            rows={8}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:border-gray-900"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="bg-gray-900 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-gray-800">
                            {tc.save || "Save"}
                          </button>
                          <button onClick={approveAndSave} className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-blue-700">
                            {t.approveAndSave || "Approve & Save"}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 px-4 py-1.5 text-xs">
                            {tc.cancel || "Cancel"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3">
                        <div className="text-xs text-gray-500 mb-2">
                          <strong>{t.to || "To"}:</strong> {e.contact.email} ({e.contact.firstName} {e.contact.lastName})
                          {e.contact.jobTitle && <span> &middot; {e.contact.jobTitle}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          <strong>{t.subject || "Subject"}:</strong> {e.subject}
                        </div>
                        {e.error && (
                          <div className="text-xs text-red-600 mb-2">
                            <strong>{t.error || "Error"}:</strong> {e.error}
                          </div>
                        )}
                        <div
                          className="bg-white border border-gray-200 rounded p-4 text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: e.htmlContent }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
