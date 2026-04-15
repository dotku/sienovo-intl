"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface VesselDetail {
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
  sessions: {
    id: string;
    controllerId: string | null;
    startedAt: string;
    endedAt: string | null;
    totalDistance: number | null;
    maxSpeed: number | null;
    baitUsed: number | null;
  }[];
}

export default function VesselDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vessel, setVessel] = useState<VesselDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/marine/vessels/${id}`)
      .then((r) => r.json())
      .then((d) => { setVessel(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;
  if (!vessel) return <div className="p-6 text-red-500">Vessel not found</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-4">
        <Link href="/admin/marine" className="text-sm text-blue-600 hover:text-blue-800">
          ← Back to Vessels
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <span
          className={`w-3 h-3 rounded-full ${vessel.isOnline ? "bg-green-500" : "bg-gray-400"}`}
        />
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{vessel.deviceId}</h1>
        {vessel.name && <span className="text-gray-500">({vessel.name})</span>}
        <span className="ml-auto px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
          {vessel.type}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase">Battery</div>
          <div className={`text-2xl font-bold ${
            (vessel.lastBattery ?? 0) > 50 ? "text-green-600" :
            (vessel.lastBattery ?? 0) > 20 ? "text-orange-500" : "text-red-500"
          }`}>
            {vessel.lastBattery?.toFixed(0) ?? "—"}%
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase">Signal</div>
          <div className="text-2xl font-bold text-blue-600">
            {vessel.lastSignal?.toFixed(0) ?? "—"}%
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase">Bait Level</div>
          <div className="text-2xl font-bold text-teal-600">
            {vessel.lastBaitLevel?.toFixed(0) ?? "—"}%
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase">Sessions</div>
          <div className="text-2xl font-bold text-gray-800">{vessel.sessions.length}</div>
        </div>
      </div>

      {/* Pairing Info */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Pairing Configuration</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-24">Device ID:</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-800">{vessel.deviceId}</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-24">Secret Key:</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-800">
              {showSecret ? vessel.secretKey : "••••••••••••••••"}
            </code>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showSecret ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-24">GPS:</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-800">
              {vessel.lastLat?.toFixed(6) ?? "—"}, {vessel.lastLng?.toFixed(6) ?? "—"}
            </code>
          </div>
        </div>
      </div>

      {/* Session History */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Session History</h2>
        </div>
        {vessel.sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No sessions recorded yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Started</th>
                <th className="px-4 py-2 text-left">Duration</th>
                <th className="px-4 py-2 text-left">Controller</th>
                <th className="px-4 py-2 text-left">Distance</th>
                <th className="px-4 py-2 text-left">Max Speed</th>
                <th className="px-4 py-2 text-left">Bait Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vessel.sessions.map((s) => {
                const duration = s.endedAt
                  ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
                  : null;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {duration != null ? `${duration} min` : (
                        <span className="text-green-600 font-medium">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-500">{s.controllerId ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.totalDistance != null ? `${s.totalDistance.toFixed(0)}m` : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.maxSpeed != null ? `${(s.maxSpeed * 3.6).toFixed(1)} km/h` : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {s.baitUsed != null ? `${s.baitUsed.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
