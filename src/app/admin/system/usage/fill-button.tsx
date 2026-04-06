"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FillButton({
  service,
  daily,
  current,
}: {
  service: string;
  daily: number;
  current: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current.toString());
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const target = parseInt(value, 10);
    if (isNaN(target) || target < 0 || target === current) {
      setEditing(false);
      setValue(current.toString());
      return;
    }

    setLoading(true);
    try {
      await fetch("/api/admin/usage/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, target }),
      });
      router.refresh();
    } finally {
      setLoading(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={daily}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") { setEditing(false); setValue(current.toString()); }
          }}
          autoFocus
          className="w-12 px-1 py-0 text-xs border border-gray-300 rounded text-center focus:outline-none focus:border-blue-500"
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {loading ? "..." : "OK"}
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => { setValue(current.toString()); setEditing(true); }}
      className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
      title="Adjust daily usage count"
    >
      Edit
    </button>
  );
}
