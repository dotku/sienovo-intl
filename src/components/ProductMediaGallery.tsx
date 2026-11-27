"use client";

import { useRef, useState } from "react";
import type { ProductMedia } from "@/lib/product-media";

// Simple carousel for /products/[slug]: main image with prev/next + swipe, thumbnails below.
// Same look as the homepage ProductGallery.
export default function ProductMediaGallery({ items }: { items: ProductMedia["gallery"] }) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = items.length;
  const go = (d: number) => setActive((i) => (i + d + n) % n);
  const cur = items[active];

  return (
    <div className="max-w-4xl mx-auto">
      <div
        className="relative aspect-video bg-white rounded-lg overflow-hidden mb-3 border border-gray-100"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.src} alt={cur.alt} className="w-full h-full object-contain p-4" />
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white text-2xl leading-none flex items-center justify-center"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white text-2xl leading-none flex items-center justify-center"
            >
              ›
            </button>
            <span className="absolute top-3 right-3 text-xs text-white bg-black/50 rounded-full px-2.5 py-1">
              {active + 1} / {n}
            </span>
          </>
        )}
      </div>
      <p className="text-center text-sm text-gray-600 mb-6">
        {cur.caption}
        {cur.illustrative && <span className="ml-2 text-xs text-gray-400">Illustrative</span>}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {items.map((g, i) => (
          <button
            key={g.src}
            type="button"
            onClick={() => setActive(i)}
            aria-label={g.caption}
            className={`relative aspect-4/3 bg-white rounded-lg overflow-hidden border-2 transition-colors ${
              active === i ? "border-accent" : "border-gray-200 hover:border-gray-400"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} alt="" loading="lazy" className="w-full h-full object-contain p-1" />
          </button>
        ))}
      </div>
    </div>
  );
}
