"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  specGroupCount: number;
  specCount: number;
}

export default function ProductsList({ products }: { products: ProductRow[] }) {
  const { dict } = useI18n();
  const t = dict.admin?.products || {};
  const tc = dict.admin?.common || {};

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{t.title || "Products"}</h2>
        <Link
          href="/admin/products/new"
          className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          {t.addProduct || "Add Product"}
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">{t.noProducts || "No products yet."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {product.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        product.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {product.active ? (tc.active || "Active") : (tc.inactive || "Inactive")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {product.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {(t.specGroupsInfo || "{groups} spec groups, {specs} specs")
                      .replace("{groups}", String(product.specGroupCount))
                      .replace("{specs}", String(product.specCount))}
                  </p>
                </div>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {tc.edit || "Edit"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
