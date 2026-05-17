"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GaDailyPoint } from "@/lib/google-analytics";

/**
 * Interactive SVG line chart for GA daily traffic.
 *
 * Interactions:
 *  - Hover anywhere over the plot → vertical crosshair snaps to the
 *    nearest day, dots scale up, and a tooltip card shows that day's
 *    values for every visible series.
 *  - Click a legend chip → toggle that series on/off. The y-axis re-
 *    scales to whatever is currently visible.
 *  - Range tabs (7d / 30d / 90d) push `?range=...` to the URL so the
 *    server refetches.
 */

type SeriesKey = "pageViews" | "sessions" | "users";

const SERIES: { key: SeriesKey; label: string; stroke: string }[] = [
  { key: "pageViews", label: "Pageviews", stroke: "#dd3232" },
  { key: "sessions", label: "Sessions", stroke: "#2563eb" },
  { key: "users", label: "Users", stroke: "#10b981" },
];

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const W = 800;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

function niceMax(m: number): number {
  if (m <= 5) return 5;
  if (m <= 10) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(m)));
  return Math.ceil(m / mag) * mag;
}

function formatShortDate(iso: string): string {
  const [, mm, dd] = iso.split("-");
  return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`;
}

function formatLongDate(iso: string): string {
  // YYYY-MM-DD → "Apr 16, 2026"
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TrafficChart({
  data,
  range,
}: {
  data: GaDailyPoint[];
  range: Range;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const visibleSeries = useMemo(
    () => SERIES.filter((s) => !hidden.has(s.key)),
    [hidden],
  );

  const yMax = useMemo(() => {
    let m = 0;
    for (const d of data) {
      for (const s of visibleSeries) {
        if (d[s.key] > m) m = d[s.key];
      }
    }
    return niceMax(m);
  }, [data, visibleSeries]);

  if (data.length === 0) {
    return (
      <ChartShell
        range={range}
        onRangeChange={(r) => navigateToRange(router, searchParams, r)}
        hidden={hidden}
        onToggleSeries={(k) =>
          setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
          })
        }
        rangeLabel=""
      >
        <div className="p-8 text-sm text-gray-500 text-center">
          No traffic data in the selected window.
        </div>
      </ChartShell>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const xAt = (i: number) => PAD.left + i * xStep;
  const yAt = (v: number) =>
    PAD.top + innerH - (yMax === 0 ? 0 : (v / yMax) * innerH);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));
  const labelStride = Math.max(1, Math.ceil(data.length / 6));

  function pathFor(key: SeriesKey): string {
    let d = "";
    for (let i = 0; i < data.length; i++) {
      const x = xAt(i);
      const y = yAt(data[i][key]);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return d.trim();
  }

  // Map a clientX from a pointer event back into a chart-data index.
  function pickIndex(clientX: number): number | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // Translate clientX into the SVG's viewBox-space.
    const ratio = (clientX - rect.left) / rect.width;
    const xView = ratio * W;
    if (xView < PAD.left || xView > W - PAD.right) return null;
    const idx = Math.round((xView - PAD.left) / xStep);
    if (idx < 0 || idx >= data.length) return null;
    return idx;
  }

  const hovered = hoverIdx != null ? data[hoverIdx] : null;
  const rangeLabel = `${data[0].date} – ${data[data.length - 1].date}`;

  return (
    <ChartShell
      range={range}
      onRangeChange={(r) => navigateToRange(router, searchParams, r)}
      hidden={hidden}
      onToggleSeries={(k) =>
        setHidden((prev) => {
          const next = new Set(prev);
          if (next.has(k)) next.delete(k);
          else next.add(k);
          return next;
        })
      }
      rangeLabel={rangeLabel}
    >
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Daily traffic line chart"
          className="w-full h-auto select-none"
          preserveAspectRatio="none"
          onMouseMove={(e) => {
            const idx = pickIndex(e.clientX);
            setHoverIdx(idx);
          }}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) setHoverIdx(pickIndex(t.clientX));
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (t) setHoverIdx(pickIndex(t.clientX));
          }}
          onTouchEnd={() => setHoverIdx(null)}
        >
          {/* Gridlines + y-axis labels */}
          {yTicks.map((t, i) => {
            const y = yAt(t);
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="#f3f4f6"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#9ca3af"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* X-axis date labels */}
          {data.map((d, i) => {
            if (i % labelStride !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={d.date}
                x={xAt(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
              >
                {formatShortDate(d.date)}
              </text>
            );
          })}

          {/* Crosshair */}
          {hoverIdx != null && (
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Lines for visible series, painted in reverse so first series
              ends up on top. */}
          {[...visibleSeries].reverse().map((s) => (
            <path
              key={s.key}
              d={pathFor(s.key)}
              fill="none"
              stroke={s.stroke}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Dots — bigger ring on the hovered day */}
          {data.map((d, i) => (
            <g key={d.date}>
              {visibleSeries.map((s) => (
                <circle
                  key={s.key}
                  cx={xAt(i)}
                  cy={yAt(d[s.key])}
                  r={i === hoverIdx ? 4 : 2.5}
                  fill="#fff"
                  stroke={s.stroke}
                  strokeWidth={i === hoverIdx ? 2 : 1.5}
                />
              ))}
            </g>
          ))}
        </svg>

        {/* Tooltip card — positioned in CSS over the SVG, snapping to the
            hovered day's x-fraction. Inverts left/right anchoring near
            the edges so it never overflows. */}
        {hovered && hoverIdx != null && (
          <div
            className="pointer-events-none absolute top-0 z-10"
            style={{
              left: `${(xAt(hoverIdx) / W) * 100}%`,
              transform:
                hoverIdx > data.length * 0.6
                  ? "translate(-100%, 0)"
                  : "translate(0, 0)",
              paddingLeft: hoverIdx > data.length * 0.6 ? 0 : 12,
              paddingRight: hoverIdx > data.length * 0.6 ? 12 : 0,
            }}
          >
            <div className="rounded-md bg-gray-900 text-white shadow-lg px-3 py-2 text-xs min-w-[140px]">
              <p className="font-semibold mb-1">{formatLongDate(hovered.date)}</p>
              {visibleSeries.length === 0 ? (
                <p className="text-gray-300">No series visible</p>
              ) : (
                <ul className="space-y-0.5">
                  {visibleSeries.map((s) => (
                    <li
                      key={s.key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: s.stroke }}
                        />
                        <span className="text-gray-300">{s.label}</span>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {hovered[s.key].toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </ChartShell>
  );
}

function ChartShell({
  range,
  onRangeChange,
  hidden,
  onToggleSeries,
  rangeLabel,
  children,
}: {
  range: Range;
  onRangeChange: (r: Range) => void;
  hidden: Set<SeriesKey>;
  onToggleSeries: (k: SeriesKey) => void;
  rangeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
        <div className="flex items-center gap-3 flex-wrap">
          {SERIES.map((s) => {
            const isHidden = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onToggleSeries(s.key)}
                aria-pressed={!isHidden}
                className={`inline-flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded transition-opacity ${
                  isHidden ? "opacity-40" : ""
                } hover:bg-gray-50`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-3 h-0.5"
                  style={{ background: s.stroke }}
                />
                <span className="text-gray-700">{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {rangeLabel && (
            <p className="text-xs text-gray-400 hidden sm:block">{rangeLabel}</p>
          )}
          <div
            role="tablist"
            aria-label="Time range"
            className="inline-flex rounded border border-gray-200 overflow-hidden"
          >
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={r === range}
                onClick={() => onRangeChange(r)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  r === range
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function navigateToRange(
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  r: Range,
) {
  const params = new URLSearchParams(searchParams?.toString() || "");
  params.set("range", String(r));
  router.push(`?${params.toString()}`, { scroll: false });
}
