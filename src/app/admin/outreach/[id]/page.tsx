"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface Step {
  id: string;
  stepOrder: number;
  delayDays: number;
  subject: string;
  promptHint: string;
}

interface EmailRecord {
  id: string;
  status: string;
  subject: string;
  step: { stepOrder: number };
  contact: { email: string; firstName: string | null; lastName: string | null; company: string | null };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  targetIndustries: string;
  targetTitles: string;
  targetCountries: string;
  targetDomains: string;
  senderName: string;
  senderEmail: string;
  productFocus: string;
  aiContext: string;
  steps: Step[];
  emails: EmailRecord[];
}

interface Prospect {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  company: string;
  industry: string;
  city: string;
  country: string;
  companySize: string;
  companyWebsite: string;
  linkedinUrl: string;
}

type Tab = "settings" | "steps" | "prospects";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { dict } = useI18n();
  const t = dict.admin?.outreach || {};
  const tc = dict.admin?.common || {};

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("settings");
  const [alert, setAlert] = useState("");

  // Steps local state
  const [steps, setSteps] = useState<Step[]>([]);

  // Search state
  const [searchDomain, setSearchDomain] = useState("");
  const [searchTitles, setSearchTitles] = useState("");
  const [searching, setSearching] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  // Generate state
  const [generating, setGenerating] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Recommend state
  const [recommending, setRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<{ name: string; domain: string; industry: string; reason: string }[]>([]);

  useEffect(() => {
    fetch(`/api/admin/outreach/campaigns/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data);
        setSteps(data.steps || []);
        if (data.targetDomains) setSearchDomain(data.targetDomains);
        if (data.targetTitles) setSearchTitles(data.targetTitles);
        setLoading(false);
      });
  }, [id]);

  const showAlert = (msg: string) => {
    setAlert(msg);
    setTimeout(() => setAlert(""), 3000);
  };

  const handleSaveSettings = async () => {
    if (!campaign) return;
    setSaving(true);
    const res = await fetch(`/api/admin/outreach/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaign),
    });
    if (res.ok) showAlert(t.saved || "Saved!");
    setSaving(false);
  };

  const handleSaveSteps = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/outreach/campaigns/${id}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: steps.map((s, i) => ({ ...s, stepOrder: i + 1 })) }),
    });
    if (res.ok) {
      const data = await res.json();
      setSteps(data);
      showAlert(t.saved || "Saved!");
    }
    setSaving(false);
  };

  const addStep = () => {
    setSteps([
      ...steps,
      { id: "", stepOrder: steps.length + 1, delayDays: steps.length === 0 ? 0 : 3, subject: "", promptHint: "" },
    ]);
  };

  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));

  const updateStep = (i: number, field: string, value: string | number) => {
    const updated = [...steps];
    updated[i] = { ...updated[i], [field]: value };
    setSteps(updated);
  };

  const handleSearch = async () => {
    if (!searchDomain) return;
    setSearching(true);
    setProspects([]);
    setSelected(new Set());
    const res = await fetch("/api/admin/outreach/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domains: searchDomain, titles: searchTitles, perPage: 15 }),
    });
    if (res.ok) {
      const data = await res.json();
      setProspects(data.prospects || []);
    }
    setSearching(false);
  };

  const toggleSelect = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === prospects.filter((p) => p.email).length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(prospects.map((_, i) => i).filter((i) => prospects[i].email)));
    }
  };

  const handleAddProspects = async () => {
    const toAdd = prospects.filter((_, i) => selected.has(i) && prospects[i].email);
    if (toAdd.length === 0) return;
    setAdding(true);
    const res = await fetch(`/api/admin/outreach/campaigns/${id}/prospects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospects: toAdd }),
    });
    if (res.ok) {
      const data = await res.json();
      showAlert(`${t.added || "Added"} ${data.added} ${t.prospects || "prospects"}`);
      // Refresh campaign
      const refreshed = await fetch(`/api/admin/outreach/campaigns/${id}`).then((r) => r.json());
      setCampaign(refreshed);
      setSelected(new Set());
    }
    setAdding(false);
  };

  const handleRecommend = async () => {
    setRecommending(true);
    const res = await fetch("/api/admin/outreach/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: id }),
    });
    if (res.ok) {
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    }
    setRecommending(false);
  };

  const applyRecommendedDomains = (selectedDomains: string[]) => {
    const existing = searchDomain ? searchDomain.split(",").map((d) => d.trim()) : [];
    const merged = [...new Set([...existing, ...selectedDomains])];
    setSearchDomain(merged.join(", "));
    setRecommendations([]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await fetch(`/api/admin/outreach/campaigns/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      showAlert(`${t.generated || "Generated"} ${data.generated} ${t.emails || "emails"}${data.failed ? `, ${data.failed} failed` : ""}`);
      const refreshed = await fetch(`/api/admin/outreach/campaigns/${id}`).then((r) => r.json());
      setCampaign(refreshed);
    }
    setGenerating(false);
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    const res = await fetch(`/api/admin/outreach/campaigns/${id}/advance`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      showAlert(`${t.created || "Created"} ${data.created} ${t.followUps || "follow-up emails"}`);
      const refreshed = await fetch(`/api/admin/outreach/campaigns/${id}`).then((r) => r.json());
      setCampaign(refreshed);
    }
    setAdvancing(false);
  };

  const handleDelete = async () => {
    if (!confirm(t.deleteConfirm || "Delete this campaign?")) return;
    await fetch(`/api/admin/outreach/campaigns/${id}`, { method: "DELETE" });
    router.push("/admin/outreach");
  };

  if (loading || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{tc.loading || "Loading..."}</p>
      </div>
    );
  }

  const pendingCount = campaign.emails.filter((e) => e.status === "pending").length;
  const draftCount = campaign.emails.filter((e) => e.status === "draft").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 truncate">{campaign.name}</h1>
          <Link href="/admin/outreach" className="text-sm text-gray-500 hover:text-gray-900">
            {tc.back || "Back"}
          </Link>
        </div>
      </header>

      {alert && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 rounded px-4 py-2 text-sm text-green-700">{alert}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex gap-1 border-b border-gray-200">
          {(["settings", "steps", "prospects"] as Tab[]).map((t2) => (
            <button
              key={t2}
              onClick={() => setTab(t2)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t2 ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t2 === "settings" ? (t.settings || "Settings") : t2 === "steps" ? (t.steps || "Steps") : (t.prospects || "Prospects")}
              {t2 === "prospects" && campaign.emails.length > 0 && (
                <span className="ml-1 text-xs text-gray-400">({campaign.emails.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Settings Tab */}
        {tab === "settings" && (
          <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.campaignName || "Campaign Name"}</label>
                <input
                  type="text"
                  value={campaign.name}
                  onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.status || "Status"}</label>
                <select
                  value={campaign.status}
                  onChange={(e) => setCampaign({ ...campaign, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.targetIndustries || "Target Industries"}</label>
                <input
                  type="text"
                  value={campaign.targetIndustries || ""}
                  onChange={(e) => setCampaign({ ...campaign, targetIndustries: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                  placeholder="manufacturing, logistics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.targetTitles || "Target Titles"}</label>
                <input
                  type="text"
                  value={campaign.targetTitles || ""}
                  onChange={(e) => setCampaign({ ...campaign, targetTitles: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                  placeholder="CTO, VP Engineering"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.targetCountries || "Target Countries"}</label>
                <input
                  type="text"
                  value={campaign.targetCountries || ""}
                  onChange={(e) => setCampaign({ ...campaign, targetCountries: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                  placeholder="United States, Germany"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.targetDomains || "Target Domains"}</label>
                <input
                  type="text"
                  value={campaign.targetDomains || ""}
                  onChange={(e) => setCampaign({ ...campaign, targetDomains: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                  placeholder="fictiv.com, tesla.com"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.senderName || "Sender Name"}</label>
                <input
                  type="text"
                  value={campaign.senderName}
                  onChange={(e) => setCampaign({ ...campaign, senderName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.senderEmail || "Sender Email"}</label>
                <input
                  type="text"
                  value={campaign.senderEmail}
                  onChange={(e) => setCampaign({ ...campaign, senderEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.productFocus || "Product Focus"}</label>
              <input
                type="text"
                value={campaign.productFocus || ""}
                onChange={(e) => setCampaign({ ...campaign, productFocus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                placeholder="INT-AIBOX for manufacturing quality control"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.aiContext || "AI Context"}</label>
              <textarea
                value={campaign.aiContext || ""}
                onChange={(e) => setCampaign({ ...campaign, aiContext: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                placeholder={t.aiContextPlaceholder || "Additional instructions for AI email generation..."}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button onClick={handleDelete} className="text-sm text-red-600 hover:text-red-800">
                {t.deleteCampaign || "Delete Campaign"}
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-gray-900 text-white px-6 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
              >
                {saving ? (tc.saving || "Saving...") : (tc.save || "Save")}
              </button>
            </div>
          </section>
        )}

        {/* Steps Tab */}
        {tab === "steps" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{t.stepsDesc || "Define the email sequence"}</p>
              <button onClick={addStep} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                {t.addStep || "+ Add Step"}
              </button>
            </div>

            {steps.map((step, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {t.step || "Step"} {i + 1}
                  </span>
                  <button onClick={() => removeStep(i)} className="text-red-500 hover:text-red-700 text-sm">
                    {tc.remove || "Remove"}
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t.delayDays || "Delay (days)"}</label>
                    <input
                      type="number"
                      min={0}
                      value={step.delayDays}
                      onChange={(e) => updateStep(i, "delayDays", parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t.subjectHint || "Subject Hint"}</label>
                    <input
                      type="text"
                      value={step.subject || ""}
                      onChange={(e) => updateStep(i, "subject", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                      placeholder={t.subjectHintPlaceholder || "e.g. Introduction to edge AI"}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.promptHint || "AI Prompt Hint"}</label>
                  <textarea
                    value={step.promptHint || ""}
                    onChange={(e) => updateStep(i, "promptHint", e.target.value)}
                    rows={2}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                    placeholder={t.promptHintPlaceholder || "e.g. Mention case study, ask about their current setup..."}
                  />
                </div>
              </div>
            ))}

            {steps.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleSaveSteps}
                  disabled={saving}
                  className="bg-gray-900 text-white px-6 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                >
                  {saving ? (tc.saving || "Saving...") : (t.saveSteps || "Save Steps")}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Prospects Tab */}
        {tab === "prospects" && (
          <section className="space-y-6">
            {/* Search Prospects */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{t.searchProspects || "Search Prospects"}</h3>
                <button
                  onClick={handleRecommend}
                  disabled={recommending}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium disabled:text-purple-300"
                >
                  {recommending ? (t.recommending || "Analyzing...") : (t.recommendDomains || "AI Recommend Domains")}
                </button>
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-purple-700">{t.recommendedDomains || "Recommended Domains"}</span>
                    <button
                      onClick={() => applyRecommendedDomains(recommendations.map((r) => r.domain))}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      {t.useAll || "Use All"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendations.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => applyRecommendedDomains([r.domain])}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-purple-200 rounded text-xs text-gray-700 hover:border-purple-400 hover:bg-purple-50 transition-colors"
                        title={`${r.name} — ${r.reason}`}
                      >
                        <span className="font-medium">{r.domain}</span>
                        <span className="text-gray-400">{r.industry}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setRecommendations([])}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {tc.dismiss || "Dismiss"}
                  </button>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.domain || "Domain / Company"}</label>
                  <input
                    type="text"
                    value={searchDomain}
                    onChange={(e) => setSearchDomain(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                    placeholder="fictiv.com, jabil.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t.titleFilter || "Title Filter"}</label>
                  <input
                    type="text"
                    value={searchTitles}
                    onChange={(e) => setSearchTitles(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                    placeholder="CTO, VP Engineering"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchDomain}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {searching ? (tc.searching || "Searching...") : (tc.search || "Search")}
                </button>
                {prospects.length > 0 && selected.size > 0 && (
                  <button
                    onClick={handleAddProspects}
                    disabled={adding}
                    className="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:bg-green-300 transition-colors"
                  >
                    {adding ? (t.adding || "Adding...") : `${t.addSelected || "Add Selected"} (${selected.size})`}
                  </button>
                )}
              </div>

              {/* Search Results */}
              {prospects.length > 0 && (
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-2 py-1.5 text-left">
                          <input type="checkbox" onChange={selectAll} checked={selected.size === prospects.filter((p) => p.email).length && selected.size > 0} />
                        </th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{tc.name || "Name"}</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{t.title || "Title"}</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{tc.email || "Email"}</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{t.company || "Company"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {prospects.map((p, i) => (
                        <tr key={i} className={`${!p.email ? "opacity-40" : "hover:bg-gray-50 cursor-pointer"}`} onClick={() => p.email && toggleSelect(i)}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={selected.has(i)} disabled={!p.email} readOnly />
                          </td>
                          <td className="px-2 py-1.5 font-medium">{p.firstName} {p.lastName}</td>
                          <td className="px-2 py-1.5 text-gray-500">{p.jobTitle}</td>
                          <td className="px-2 py-1.5 text-gray-500">{p.email || "N/A"}</td>
                          <td className="px-2 py-1.5 text-gray-500">{p.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Campaign Emails / Actions */}
            {campaign.emails.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {t.campaignEmails || "Campaign Emails"} ({campaign.emails.length})
                  </h3>
                  <div className="flex gap-2">
                    {pendingCount > 0 && (
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
                      >
                        {generating ? (t.generating || "Generating...") : `${t.generateEmails || "Generate"} (${pendingCount})`}
                      </button>
                    )}
                    {draftCount > 0 && (
                      <Link
                        href={`/admin/outreach/emails?campaignId=${id}&status=draft`}
                        className="bg-yellow-500 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-yellow-600 transition-colors"
                      >
                        {t.reviewDrafts || "Review Drafts"} ({draftCount})
                      </Link>
                    )}
                    <button
                      onClick={handleAdvance}
                      disabled={advancing}
                      className="bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
                    >
                      {advancing ? (t.advancing || "Advancing...") : (t.advanceCampaign || "Advance Follow-ups")}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{t.contact || "Contact"}</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{t.step || "Step"}</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{t.subject || "Subject"}</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-700">{t.status || "Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {campaign.emails.slice(0, 50).map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5">
                            <span className="font-medium">{e.contact.firstName} {e.contact.lastName}</span>
                            <span className="text-gray-400 ml-1">{e.contact.email}</span>
                          </td>
                          <td className="px-2 py-1.5 text-gray-500">#{e.step.stepOrder}</td>
                          <td className="px-2 py-1.5 text-gray-500 max-w-48 truncate">{e.subject || "-"}</td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              e.status === "sent" ? "bg-green-100 text-green-700" :
                              e.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                              e.status === "approved" ? "bg-blue-100 text-blue-700" :
                              e.status === "failed" ? "bg-red-100 text-red-700" :
                              e.status === "skipped" ? "bg-gray-100 text-gray-500" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {e.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
