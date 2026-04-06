"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";

interface SpecItem {
  label: string;
  value: string;
}

interface SpecGroup {
  category: string;
  items: SpecItem[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  specGroups: SpecGroup[];
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const { dict } = useI18n();
  const t = dict.admin?.products || {};
  const tc = dict.admin?.common || {};

  const [product, setProduct] = useState<Product>({
    id: "",
    name: "",
    slug: "",
    description: "",
    image: "",
    active: true,
    specGroups: [],
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/products/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setProduct(data);
          setLoading(false);
        });
    }
  }, [id, isNew]);

  const handleSave = async () => {
    setSaving(true);
    const url = isNew ? "/api/admin/products" : `/api/admin/products/${id}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });

    if (res.ok) {
      router.push("/admin");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(t.deleteConfirm || "Delete this product?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    router.push("/admin");
  };

  const addSpecGroup = () => {
    setProduct({
      ...product,
      specGroups: [...product.specGroups, { category: "", items: [] }],
    });
  };

  const removeSpecGroup = (gi: number) => {
    setProduct({
      ...product,
      specGroups: product.specGroups.filter((_, i) => i !== gi),
    });
  };

  const updateSpecGroup = (gi: number, category: string) => {
    const groups = [...product.specGroups];
    groups[gi] = { ...groups[gi], category };
    setProduct({ ...product, specGroups: groups });
  };

  const addSpecItem = (gi: number) => {
    const groups = [...product.specGroups];
    groups[gi] = {
      ...groups[gi],
      items: [...groups[gi].items, { label: "", value: "" }],
    };
    setProduct({ ...product, specGroups: groups });
  };

  const removeSpecItem = (gi: number, si: number) => {
    const groups = [...product.specGroups];
    groups[gi] = {
      ...groups[gi],
      items: groups[gi].items.filter((_, i) => i !== si),
    };
    setProduct({ ...product, specGroups: groups });
  };

  const updateSpecItem = (
    gi: number,
    si: number,
    field: "label" | "value",
    val: string
  ) => {
    const groups = [...product.specGroups];
    const items = [...groups[gi].items];
    items[si] = { ...items[si], [field]: val };
    groups[gi] = { ...groups[gi], items };
    setProduct({ ...product, specGroups: groups });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{tc.loading || "Loading..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            {isNew ? (t.newProduct || "New Product") : (t.editProduct || "Edit: {name}").replace("{name}", product.name)}
          </h1>
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            {tc.back || "Back"}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Basic Info */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">{t.basicInfo || "Basic Information"}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc.name || "Name"}
              </label>
              <input
                type="text"
                value={product.name}
                onChange={(e) =>
                  setProduct({ ...product, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                placeholder="INT-AIBOX-P-8"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.slug || "Slug"}
              </label>
              <input
                type="text"
                value={product.slug}
                onChange={(e) =>
                  setProduct({ ...product, slug: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                placeholder="int-aibox-p-8"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tc.description || "Description"}
            </label>
            <textarea
              value={product.description || ""}
              onChange={(e) =>
                setProduct({ ...product, description: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.imagePath || "Image Path"}
              </label>
              <input
                type="text"
                value={product.image || ""}
                onChange={(e) =>
                  setProduct({ ...product, image: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                placeholder="/images/products/product.png"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={product.active}
                  onChange={(e) =>
                    setProduct({ ...product, active: e.target.checked })
                  }
                  className="rounded"
                />
                {tc.active || "Active"}
              </label>
            </div>
          </div>
        </section>

        {/* Spec Groups */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t.specifications || "Specifications"}</h2>
            <button
              onClick={addSpecGroup}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {t.addGroup || "+ Add Group"}
            </button>
          </div>

          {product.specGroups.map((group, gi) => (
            <div
              key={gi}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={group.category}
                  onChange={(e) => updateSpecGroup(gi, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-medium focus:outline-none focus:border-gray-900"
                  placeholder={t.categoryName || "Category name"}
                />
                <button
                  onClick={() => removeSpecGroup(gi)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  {tc.remove || "Remove"}
                </button>
              </div>

              {group.items.map((item, si) => (
                <div key={si} className="flex items-center gap-2 ml-4">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      updateSpecItem(gi, si, "label", e.target.value)
                    }
                    className="w-32 shrink-0 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                    placeholder={t.label || "Label"}
                  />
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) =>
                      updateSpecItem(gi, si, "value", e.target.value)
                    }
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-gray-900"
                    placeholder={t.value || "Value"}
                  />
                  <button
                    onClick={() => removeSpecItem(gi, si)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    x
                  </button>
                </div>
              ))}

              <button
                onClick={() => addSpecItem(gi)}
                className="ml-4 text-xs text-blue-600 hover:text-blue-800"
              >
                {t.addSpec || "+ Add Spec"}
              </button>
            </div>
          ))}
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {!isNew && (
              <button
                onClick={handleDelete}
                className="text-sm text-red-600 hover:text-red-800"
              >
                {t.deleteProduct || "Delete Product"}
              </button>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 text-white px-6 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {saving ? (tc.saving || "Saving...") : isNew ? (t.createProduct || "Create Product") : (t.saveChanges || "Save Changes")}
          </button>
        </div>
      </main>
    </div>
  );
}
