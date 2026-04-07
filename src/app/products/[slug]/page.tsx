"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CTA from "@/components/CTA";
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
  description: string | null;
  image: string | null;
  specGroups: SpecGroup[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { dict } = useI18n();
  const t = dict.productDetail ?? {};

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data: Product[]) => {
        setAllProducts(data);
        const found = data.find((p: Product) => p.slug === slug);
        setProduct(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-gray-400">{dict.admin?.common?.loading || "Loading..."}</div>
        </main>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{t.notFound || "Product not found"}</h1>
          <Link href="/#products" className="text-accent hover:underline">
            {t.backToProducts || "Back to Products"}
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const otherProducts = allProducts.filter((p) => p.slug !== slug);

  return (
    <>
      <Header />
      <main>
        {/* Breadcrumb */}
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-500">
              <Link href="/" className="hover:text-accent">{t.home || "Home"}</Link>
              <span>/</span>
              <Link href="/#products" className="hover:text-accent">{t.products || "Products"}</Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{product.name}</span>
            </nav>
          </div>
        </div>

        {/* Hero */}
        <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">{product.name}</h1>
              <p className="text-lg md:text-xl text-gray-300 leading-relaxed">
                {product.description}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <a
                  href="https://calendly.com/sienovo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-accent hover:bg-red-700 text-white px-8 py-3 rounded font-medium text-center transition-colors"
                >
                  {t.requestDemo || "Request a Demo"}
                </a>
                <a
                  href="#specs"
                  className="border border-gray-500 hover:border-white text-white px-8 py-3 rounded font-medium text-center transition-colors"
                >
                  {t.viewSpecs || "View Specifications"}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Specs */}
        <section id="specs" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {t.specsTitle || "Technical Specifications"}
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                {product.name} — {t.specsSubtitle || "detailed hardware specifications"}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {product.specGroups.map((section) => (
                <div
                  key={section.category}
                  className="border border-gray-100 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-900 text-white px-5 py-3 font-semibold text-sm">
                    {section.category}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className="flex px-5 py-3 text-sm"
                      >
                        <span className="w-32 shrink-0 font-medium text-gray-500">
                          {item.label}
                        </span>
                        <span className="text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Other Products */}
        {otherProducts.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                {t.otherProducts || "Other Products"}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {otherProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    className="group bg-white rounded-lg border border-gray-100 hover:border-accent/30 hover:shadow-lg transition-all p-5"
                  >
                    <h3 className="font-bold text-gray-900 group-hover:text-accent transition-colors mb-2">
                      {p.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                      {t.viewDetails || "View Details"}
                      <svg className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <CTA />
      </main>
      <Footer />
    </>
  );
}
