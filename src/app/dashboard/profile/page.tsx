"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: "", companyName: "", phone: "", country: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { dict } = useI18n();
  const t = dict.dashboard?.profile || {};

  useEffect(() => {
    fetch("/api/dashboard/profile")
      .then((r) => r.json())
      .then((data) => setProfile(data))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/dashboard/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        companyName: profile.companyName,
        phone: profile.phone,
        country: profile.country,
      }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500">{dict.admin?.common?.loading || "Loading..."}</div>;

  return (
    <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">{t.title || "Profile"}</h2>

      <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.email || "Email"}</label>
          <input type="email" value={profile.email} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.name || "Name"}</label>
          <input type="text" value={profile.name || ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.company || "Company"}</label>
          <input type="text" value={profile.companyName || ""} onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.phone || "Phone"}</label>
          <input type="tel" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.country || "Country"}</label>
          <input type="text" value={profile.country || ""} onChange={(e) => setProfile({ ...profile, country: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900" />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && <span className="text-xs text-green-600">{t.saved || "Saved!"}</span>}
          <button type="submit" disabled={saving}
            className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300">
            {saving ? (t.saving || "Saving...") : (t.save || "Save")}
          </button>
        </div>
      </form>
    </main>
  );
}
