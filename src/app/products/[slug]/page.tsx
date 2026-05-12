import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CTA from "@/components/CTA";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      specGroups: {
        include: { items: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

async function getOtherProducts(slug: string) {
  return prisma.product.findMany({
    where: { active: true, NOT: { slug } },
    select: { id: true, name: true, slug: true, description: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function generateStaticParams() {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { slug: true },
    });
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch {
    product = null;
  }
  if (!product) return { title: "Product Not Found" };

  const description =
    product.description?.slice(0, 160).trim() ||
    `${product.name} — edge AI computing solution by Sienovo.`;
  const url = `${SITE_URL}/products/${product.slug}`;
  const image = product.image || `${SITE_URL}/images/pptx/aibox-sg8.png`;

  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: `${product.name} | Sienovo`,
      description,
      url,
      siteName: "Sienovo",
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | Sienovo`,
      description,
      images: [image],
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const otherProducts = await getOtherProducts(slug);
  const url = `${SITE_URL}/products/${product.slug}`;
  const image = product.image || `${SITE_URL}/images/pptx/aibox-sg8.png`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.name,
    description:
      product.description ||
      `${product.name} — edge AI computing solution by Sienovo.`,
    image,
    brand: { "@type": "Brand", name: "Sienovo" },
    category: "Edge AI Computing",
    url,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: `${SITE_URL}/#products`,
      },
      { "@type": "ListItem", position: 3, name: product.name, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Header />
      <main>
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-500">
              <Link href="/" className="hover:text-accent">
                Home
              </Link>
              <span>/</span>
              <Link href="/#products" className="hover:text-accent">
                Products
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{product.name}</span>
            </nav>
          </div>
        </div>

        <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                {product.name}
              </h1>
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
                  Request a Demo
                </a>
                <a
                  href="#specs"
                  className="border border-gray-500 hover:border-white text-white px-8 py-3 rounded font-medium text-center transition-colors"
                >
                  View Specifications
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="specs" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Technical Specifications
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                {product.name} — detailed hardware specifications
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {product.specGroups.map((section) => (
                <div
                  key={section.id}
                  className="border border-gray-100 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-900 text-white px-5 py-3 font-semibold text-sm">
                    {section.category}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
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

        {otherProducts.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                Other Products
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
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {p.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                      View Details
                      <svg
                        className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <CTA />
      </main>
      <Footer />
    </>
  );
}
