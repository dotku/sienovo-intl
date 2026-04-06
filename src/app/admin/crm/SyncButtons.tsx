"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

interface SyncResult {
  synced: number;
  total?: number;
  skipped?: number;
}

function SyncButton({
  label,
  endpoint,
  icon,
}: {
  label: string;
  endpoint: string;
  icon: React.ReactNode;
}) {
  const { dict } = useI18n();
  const ts = dict.admin?.sync || {};
  const tc = dict.admin?.common || {};

  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setStatus("syncing");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setStatus("done");
        setTimeout(() => window.location.reload(), 1500);
      } else if (res.status === 401) {
        const errData = await res.json().catch(() => ({}));
        window.location.href = errData.redirectUrl || "/api/admin/google/authorize";
        return;
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status === "done" && result && (
        <span className="text-xs text-green-600">
          {(ts.syncedCount || "Synced {count} contacts").replace("{count}", String(result.synced))}
        </span>
      )}
      {status === "error" && (
        <span className="text-xs text-red-600">{tc.failed || "Failed"}</span>
      )}
      <button
        onClick={handleSync}
        disabled={status === "syncing"}
        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
      >
        {icon}
        {status === "syncing" ? (ts.syncing || "Syncing...") : label}
      </button>
    </div>
  );
}

export function GoogleSyncButton({ connected }: { connected: boolean }) {
  const { dict } = useI18n();
  const ts = dict.admin?.sync || {};

  if (!connected) {
    return (
      <a
        href="/api/admin/google/authorize"
        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        <GoogleIcon />
        {ts.connectGoogle || "Connect Google"}
      </a>
    );
  }

  return (
    <SyncButton
      label={ts.syncGoogle || "Sync Google"}
      endpoint="/api/admin/google/sync"
      icon={<GoogleIcon />}
    />
  );
}

export function BrevoSyncButton() {
  const { dict } = useI18n();
  const ts = dict.admin?.sync || {};

  return (
    <SyncButton
      label={ts.syncEmail || "Sync Email Service"}
      endpoint="/api/admin/brevo/sync"
      icon={<MailIcon />}
    />
  );
}

function ApolloIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

interface EnrichPreview {
  contactId: string;
  email: string;
  current: Record<string, string | null>;
  apollo: Record<string, string | null>;
}

export function ApolloEnrichButton() {
  const { dict } = useI18n();
  const ts = dict.admin?.sync || {};
  const tc = dict.admin?.common || {};

  const [status, setStatus] = useState<"idle" | "loading" | "review" | "applying" | "done" | "error">("idle");
  const [previews, setPreviews] = useState<EnrichPreview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleFetch = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/apollo/enrich");
      if (res.ok) {
        const data = await res.json();
        setPreviews(data.previews);
        setSelected(new Set(data.previews.map((p: EnrichPreview) => p.contactId)));
        setStatus(data.previews.length > 0 ? "review" : "done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleApply = async () => {
    setStatus("applying");
    const approvals = previews
      .filter((p) => selected.has(p.contactId))
      .map((p) => ({ contactId: p.contactId, data: p.apollo }));

    try {
      const res = await fetch("/api/admin/apollo/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvals }),
      });
      if (res.ok) {
        setStatus("done");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const FIELDS = ["firstName", "lastName", "company", "jobTitle", "industry", "linkedinUrl", "city", "country"];

  return (
    <>
      <button
        onClick={handleFetch}
        disabled={status === "loading" || status === "applying"}
        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
      >
        <ApolloIcon />
        {status === "loading"
          ? (ts.fetching || "Fetching...")
          : status === "done"
            ? (tc.done || "Done!")
            : (ts.jytechEnrich || "JYTechAI Enrich")}
      </button>

      {status === "review" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ts.enrichReview || "JYTechAI Enrichment Review"}
                </h3>
                <p className="text-sm text-gray-500">
                  {(ts.enrichReviewSub || "{count} contacts found. Select which to update.").replace("{count}", String(previews.length))}
                </p>
              </div>
              <button
                onClick={() => setStatus("idle")}
                className="text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {previews.map((p) => (
                <div
                  key={p.contactId}
                  className={`border rounded-lg p-4 ${selected.has(p.contactId) ? "border-blue-300 bg-blue-50/50" : "border-gray-200"}`}
                >
                  <label className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.contactId)}
                      onChange={() => toggleSelect(p.contactId)}
                      className="rounded"
                    />
                    <span className="font-medium text-gray-900">{p.email}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="font-medium text-gray-500">{ts.field || "Field"}</div>
                    <div className="font-medium text-gray-500">{ts.current || "Current"}</div>
                    <div className="font-medium text-blue-600">{ts.fromApollo || "From Apollo"}</div>
                    {FIELDS.map((field) => {
                      const cur = p.current[field] || "";
                      const neo = p.apollo[field] || "";
                      if (!neo && !cur) return null;
                      const changed = neo && neo !== cur;
                      return (
                        <div key={field} className="contents">
                          <div className="text-gray-500 py-1">{field}</div>
                          <div className="text-gray-700 py-1">{cur || "—"}</div>
                          <div className={`py-1 ${changed ? "text-blue-700 font-medium" : "text-gray-400"}`}>
                            {neo || "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {(ts.selectedOf || "{selected} of {total} selected")
                  .replace("{selected}", String(selected.size))
                  .replace("{total}", String(previews.length))}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setStatus("idle")}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  {tc.cancel || "Cancel"}
                </button>
                <button
                  onClick={handleApply}
                  disabled={selected.size === 0}
                  className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                >
                  {(ts.applyUpdates || "Apply {count} Updates").replace("{count}", String(selected.size))}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
