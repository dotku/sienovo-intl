"use client";

import { useEffect, useState } from "react";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";

interface TeamUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  companyName: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  sales: "bg-blue-100 text-blue-700",
  fulfillment: "bg-orange-100 text-orange-700",
  support: "bg-green-100 text-green-700",
  content: "bg-pink-100 text-pink-700",
};

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"team" | "customers" | "all">("team");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    const res = await fetch("/api/admin/team");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  async function updateRole(id: string, role: string | null) {
    setUpdating(id);
    const res = await fetch(`/api/admin/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: updated.role } : u)));
    } else {
      const err = await res.json();
      alert(err.error || "Failed to update role");
    }
    setUpdating(null);
  }

  const filtered = users.filter((u) => {
    if (filter === "team" && !u.role) return false;
    if (filter === "customers" && u.role) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: users.length,
    team: users.filter((u) => u.role).length,
    customers: users.filter((u) => !u.role).length,
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Team Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          {stats.team} team members · {stats.customers} customers · {stats.total} total
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1.5">
          {(["team", "customers", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full ${
                filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "team" ? `Team (${stats.team})` : f === "customers" ? `Customers (${stats.customers})` : `All (${stats.total})`}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-900"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No users found</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-700">User</th>
                <th className="px-4 py-3 font-medium text-gray-700">Joined</th>
                <th className="px-4 py-3 font-medium text-gray-700">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.name || u.email}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                    {u.companyName && (
                      <div className="text-xs text-gray-400">{u.companyName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role || ""}
                        onChange={(e) => updateRole(u.id, e.target.value || null)}
                        disabled={updating === u.id}
                        className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${
                          u.role ? ROLE_COLORS[u.role] || "bg-gray-100" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <option value="">Customer</option>
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r as Role]}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <h3 className="font-semibold mb-2">Role Permissions</h3>
        <ul className="space-y-1 text-xs">
          <li><strong>Owner</strong> — Full access to everything (including team management)</li>
          <li><strong>Sales</strong> — CRM, outreach, view orders, view tickets</li>
          <li><strong>Fulfillment</strong> — Manage orders and shipping/tracking</li>
          <li><strong>Support</strong> — Manage customer tickets, AI chat</li>
          <li><strong>Content</strong> — Knowledge base, articles, products</li>
        </ul>
        <p className="mt-2 text-xs text-blue-700">
          To add a team member: have them register at <code className="bg-white px-1 rounded">/dashboard</code> first, then change their role here.
        </p>
      </div>
    </main>
  );
}
