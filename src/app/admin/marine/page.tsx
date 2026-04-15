"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Vessel {
  id: string;
  deviceId: string;
  name: string | null;
  type: string;
  secretKey: string;
  lastLat: number | null;
  lastLng: number | null;
  lastBattery: number | null;
  lastSignal: number | null;
  lastBaitLevel: number | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  _count: { sessions: number };
}

export default function MarinePage() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newName, setNewName] = useState("");

  const fetchVessels = useCallback(async () => {
    const res = await fetch("/api/admin/marine/vessels");
    if (res.ok) setVessels(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVessels();
    const interval = setInterval(fetchVessels, 10000);
    return () => clearInterval(interval);
  }, [fetchVessels]);

  const handleAdd = async () => {
    if (!newDeviceId.trim()) return;
    const res = await fetch("/api/admin/marine/vessels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: newDeviceId.trim(), name: newName.trim() || null }),
    });
    if (res.ok) {
      setNewDeviceId("");
      setNewName("");
      setShowAdd(false);
      fetchVessels();
    }
  };

  const handleDelete = async (id: string, deviceId: string) => {
    if (!confirm(`Delete vessel ${deviceId}?`)) return;
    await fetch(`/api/admin/marine/vessels/${id}`, { method: "DELETE" });
    fetchVessels();
  };

  const online = vessels.filter((v) => v.isOnline).length;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vessel Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {vessels.length} vessels registered · {online} online
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + Add Vessel
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white border rounded-lg p-4 mb-4 flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Device ID *</label>
            <input
              value={newDeviceId}
              onChange={(e) => setNewDeviceId(e.target.value.toUpperCase())}
              placeholder="BOAT-A3F8"
              className="border rounded-lg px-3 py-2 text-sm font-mono w-40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="湖边一号"
              className="border rounded-lg px-3 py-2 text-sm w-40"
            />
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            Create
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="px-4 py-2 text-gray-500 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Vessel table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : vessels.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">🚢</p>
          <p>No vessels registered yet</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Device ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Battery</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Sessions</th>
                <th className="px-4 py-3 text-left">Last Seen</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vessels.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        v.isOnline
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          v.isOnline ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {v.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">
                    <Link href={`/admin/marine/${v.id}`} className="hover:text-blue-600">
                      {v.deviceId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.name || "—"}</td>
                  <td className="px-4 py-3">
                    {v.lastBattery != null ? (
                      <span
                        className={
                          v.lastBattery > 50
                            ? "text-green-600"
                            : v.lastBattery > 20
                            ? "text-orange-500"
                            : "text-red-500"
                        }
                      >
                        {v.lastBattery.toFixed(0)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {v.lastLat != null
                      ? `${v.lastLat.toFixed(4)}, ${v.lastLng?.toFixed(4)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{v._count.sessions}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {v.lastSeenAt
                      ? new Date(v.lastSeenAt).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/marine/${v.id}`}
                      className="text-blue-600 hover:text-blue-800 text-xs mr-3"
                    >
                      Detail
                    </Link>
                    <button
                      onClick={() => handleDelete(v.id, v.deviceId)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Relay Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Relay Server Info</h3>
        <div className="text-xs text-blue-700 space-y-1 font-mono">
          <p>API: {typeof window !== "undefined" ? window.location.origin : ""}/api/marine/vessels</p>
          <p>WebSocket: wss://{typeof window !== "undefined" ? window.location.host : ""}/api/marine/relay</p>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Configure these URLs in the Sienovo Marine controller app under &quot;Relay Mode&quot;.
        </p>
      </div>
    </div>
  );
}
