import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/site";
import { BRAND_ASSETS, PRODUCT_IMAGES, PRODUCT_VIDEOS } from "./assets";

export const metadata: Metadata = {
  title: "Press & Media Kit",
  description:
    "Sienovo press kit — brand assets, product imagery, executive bios, and media contact for journalists covering edge AI computing and industrial video analytics.",
  alternates: {
    canonical: "/press",
    languages: {
      en: "/press",
      "x-default": "/press",
      zh: "/zh/press",
    },
  },
  openGraph: {
    title: "Press & Media Kit | Sienovo",
    description:
      "Brand assets, product imagery, and media contact for Sienovo — edge AI computing for industrial video analytics.",
    url: `${SITE_URL}/press`,
    type: "website",
  },
};

const MEDIA_EMAIL = "collin.liu@sienovo.cn";
const YOUTUBE_CHANNEL = "https://www.youtube.com/@dk_wholesale";

const BOILERPLATE_PARAGRAPHS = [
  "Sienovo (深圳信迈) is an edge AI computing company delivering intelligent video analytics for industrial environments. Our INT-AIBOX series combines up to 12 TOPS of INT8 AI compute with 8 to 16 channels of HD video ingest and 40+ pre-loaded AI algorithms covering safety, security, and operations.",
  "Sienovo devices are fanless, industrial-grade, and ship with a managed platform for remote configuration, fleet operations, and OTA algorithm updates. Customers deploy Sienovo in smart communities, gas stations, construction sites, parks, retail, and environmental monitoring across global markets.",
];

const FAST_FACTS: Array<[string, string]> = [
  ["Founded", "2014"],
  ["Headquarters", "Shenzhen, China"],
  ["Global office", "600 California St, San Francisco, CA 94108"],
  ["Product line", "INT-AIBOX edge AI computing boxes"],
  ["AI compute", "7.2 – 12 TOPS INT8"],
  ["Video channels", "8 – 16 HD channels per device"],
  ["AI algorithms", "40+ pre-loaded, OTA-updatable"],
];

export default function PressPage() {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Sienovo",
    alternateName: ["深圳信迈", "Shenzhen Sienovo"],
    url: SITE_URL,
    logo: `${SITE_URL}${BRAND_ASSETS.logoSquare.href}`,
    image: BRAND_ASSETS.previews.map((p) => `${SITE_URL}${p.href}`),
    description:
      "Edge AI computing for industrial video analytics. INT-AIBOX series with up to 12 TOPS, 8/16-channel HD video, and 40+ built-in AI algorithms.",
    sameAs: [YOUTUBE_CHANNEL],
    address: {
      "@type": "PostalAddress",
      streetAddress: "600 California St",
      addressLocality: "San Francisco",
      addressRegion: "CA",
      postalCode: "94108",
      addressCountry: "US",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        email: MEDIA_EMAIL,
        contactType: "media inquiries",
        availableLanguage: ["en", "zh"],
      },
      {
        "@type": "ContactPoint",
        email: MEDIA_EMAIL,
        contactType: "sales",
        availableLanguage: ["en", "zh"],
      },
    ],
  };

  const videoLd = PRODUCT_VIDEOS.map((v) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: v.title,
    description: v.description,
    thumbnailUrl: v.poster ? `${SITE_URL}${v.poster}` : undefined,
    contentUrl: `${SITE_URL}${v.src}`,
    uploadDate: v.uploadDate,
    publisher: {
      "@type": "Organization",
      name: "Sienovo",
      logo: { "@type": "ImageObject", url: `${SITE_URL}${BRAND_ASSETS.logoSquare.href}` },
    },
  }));

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />
      {videoLd.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <p className="text-sm font-semibold tracking-widest text-accent uppercase mb-3">
              Press &amp; Media Kit
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-gray-900 max-w-3xl">
              Everything journalists need to cover Sienovo
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 max-w-2xl">
              Brand assets, product imagery, executive bios, and a direct
              line to our media team. For interview requests or briefings,
              email{" "}
              <a
                href={`mailto:${MEDIA_EMAIL}?subject=Media%20inquiry%20-%20Sienovo`}
                className="text-accent hover:underline"
              >
                {MEDIA_EMAIL}
              </a>
              .
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#brand-assets"
                className="inline-flex items-center px-5 py-2.5 rounded bg-accent text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Download brand assets
              </a>
              <a
                href={`mailto:${MEDIA_EMAIL}?subject=Media%20inquiry%20-%20Sienovo`}
                className="inline-flex items-center px-5 py-2.5 rounded border border-gray-300 text-gray-800 text-sm font-semibold hover:border-accent hover:text-accent transition-colors"
              >
                Contact media team
              </a>
            </div>
          </div>
        </section>

        {/* About / Boilerplate */}
        <section
          id="about"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
        >
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                About Sienovo
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Approved boilerplate — please quote as-is or shorten without
                altering technical claims.
              </p>
              {BOILERPLATE_PARAGRAPHS.map((p, i) => (
                <p
                  key={i}
                  className="text-base text-gray-700 leading-relaxed mb-4"
                >
                  {p}
                </p>
              ))}
            </div>
            <aside className="lg:col-span-1">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm tracking-wide uppercase">
                  Fast facts
                </h3>
                <dl className="space-y-3">
                  {FAST_FACTS.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-500">{k}</dt>
                      <dd className="text-sm text-gray-900 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </aside>
          </div>
        </section>

        {/* Brand assets */}
        <section
          id="brand-assets"
          className="bg-gray-50 border-y border-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Brand assets
            </h2>
            <p className="text-base text-gray-600 mb-8 max-w-2xl">
              Direct downloads for editorial use. Please don&apos;t crop the
              logo or change its colors. The official wordmark color is{" "}
              <code className="px-1.5 py-0.5 rounded bg-white text-accent text-sm">
                #dd3232
              </code>
              .
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              {[BRAND_ASSETS.logoLandscape, BRAND_ASSETS.logoSquare].map(
                (asset) => (
                  <a
                    key={asset.href}
                    href={asset.href}
                    download
                    className="group block rounded-lg bg-white border border-gray-200 p-6 hover:border-accent transition-colors"
                  >
                    <div className="h-32 flex items-center justify-center bg-white rounded mb-4 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.href}
                        alt={asset.alt}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {asset.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {asset.dimensions} · PNG · click to download
                    </p>
                  </a>
                ),
              )}
            </div>
          </div>
        </section>

        {/* Product imagery */}
        <section
          id="product-imagery"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Product imagery
          </h2>
          <p className="text-base text-gray-600 mb-8 max-w-2xl">
            High-resolution product photography for editorial use. Right-click
            any image and save, or click to view full size.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRODUCT_IMAGES.map((img) => {
              const linksToProduct = !!img.productSlug;
              const href = linksToProduct
                ? `/products/${img.productSlug}`
                : img.src;
              return (
                <a
                  key={img.src}
                  href={href}
                  {...(linksToProduct
                    ? {}
                    : { target: "_blank", rel: "noopener noreferrer" })}
                  className="group block rounded-lg overflow-hidden border border-gray-200 hover:border-accent transition-colors"
                >
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {img.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {img.caption}
                      </p>
                    </div>
                    {linksToProduct && (
                      <span className="text-xs font-semibold text-accent whitespace-nowrap shrink-0 mt-0.5">
                        View product →
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* Product videos */}
        <section
          id="product-videos"
          className="bg-gray-50 border-y border-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Product videos
            </h2>
            <p className="text-base text-gray-600 mb-8 max-w-2xl">
              Short field clips of INT-AIBOX deployments. Embeddable on
              editorial sites with attribution to Sienovo. Longer-form
              content available on our{" "}
              <a
                href={YOUTUBE_CHANNEL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                YouTube channel
              </a>
              .
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {PRODUCT_VIDEOS.map((v) => (
                <figure
                  key={v.src}
                  className="rounded-lg overflow-hidden border border-gray-200 bg-white"
                >
                  <video
                    controls
                    preload="metadata"
                    poster={v.poster}
                    className="w-full aspect-video bg-black"
                  >
                    <source src={v.src} type="video/mp4" />
                  </video>
                  <figcaption className="p-4">
                    <p className="font-medium text-gray-900 text-sm">
                      {v.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {v.description}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Media contact */}
        <section
          id="media-contact"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
        >
          <div className="rounded-lg bg-gray-900 text-white p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Media inquiries
            </h2>
            <p className="text-base text-gray-300 max-w-2xl mb-6">
              For interview requests, product briefings, executive availability,
              or fact-checking — please email us. We typically respond within
              one business day.
            </p>
            <a
              href={`mailto:${MEDIA_EMAIL}?subject=Media%20inquiry%20-%20Sienovo`}
              className="inline-flex items-center px-5 py-2.5 rounded bg-accent text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              {MEDIA_EMAIL}
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
