"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  specGroups: {
    category: string;
    items: { label: string; value: string }[];
  }[];
}

// Highlight spec for each product type
const PRODUCT_HIGHLIGHTS: Record<string, { icon: string; stats: { label: string; value: string }[] }> = {
  "int-aibox-p-8": {
    icon: "M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z",
    stats: [
      { label: "AI (INT8)", value: "7.2 TOPS" },
      { label: "Video", value: "8CH" },
      { label: "Power", value: "12.5W" },
    ],
  },
  "int-aibox-rk-4": {
    icon: "M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z",
    stats: [
      { label: "AI (INT8)", value: "6 TOPS" },
      { label: "Video", value: "4CH" },
      { label: "Power", value: "~8W" },
    ],
  },
  "xm3588-gw01": {
    icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
    stats: [
      { label: "NPU", value: "6 TOPS" },
      { label: "LAN", value: "4-Port" },
      { label: "Decode", value: "16CH" },
    ],
  },
  "se10-u0": {
    icon: "M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z",
    stats: [
      { label: "AI (INT8)", value: "192 TOPS" },
      { label: "Video", value: "192CH" },
      { label: "Nodes", value: "12" },
    ],
  },
  "xm9691": {
    icon: "M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z",
    stats: [
      { label: "CPU", value: "i3-1115G4" },
      { label: "LAN", value: "6-Port" },
      { label: "Serial", value: "6×RS485" },
    ],
  },
};

function getTagForProduct(slug: string, dict: Record<string, string>): string {
  const tags: Record<string, string> = {
    "int-aibox-p-8": dict.tagEdgeAI || "Edge AI",
    "int-aibox-rk-4": dict.tagEdgeAI || "Edge AI",
    "xm3588-gw01": dict.tagGateway || "IoT Gateway",
    "se10-u0": dict.tagServer || "AI Server",
    "xm9691": dict.tagIPC || "Industrial Controller",
  };
  return tags[slug] || "Product";
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const { dict } = useI18n();
  const t = dict.products ?? {};

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {});
  }, []);

  if (products.length === 0) return null;

  return (
    <section id="products" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t.title || "Product Lineup"}
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            {t.subtitle || "Comprehensive edge AI and industrial computing solutions for every scale."}
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => {
            const highlight = PRODUCT_HIGHLIGHTS[product.slug];
            const tag = getTagForProduct(product.slug, t);
            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group bg-white rounded-xl border border-gray-100 hover:border-accent/30 hover:shadow-xl transition-all overflow-hidden flex flex-col"
              >
                {/* Tag */}
                <div className="px-6 pt-5 pb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent bg-red-50 px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                </div>

                {/* Header */}
                <div className="px-6 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    {highlight && (
                      <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-white shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={highlight.icon} />
                        </svg>
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-accent transition-colors">
                      {product.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">
                    {product.description}
                  </p>
                </div>

                {/* Stats */}
                {highlight && (
                  <div className="mt-auto border-t border-gray-100 bg-gray-50 px-6 py-4 grid grid-cols-3 gap-4">
                    {highlight.stats.map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p className="text-sm font-bold text-gray-900">{stat.value}</p>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-accent group-hover:underline">
                    {t.viewDetails || "View Details"}
                  </span>
                  <svg className="w-4 h-4 text-accent transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
