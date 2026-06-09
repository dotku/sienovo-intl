import { MetadataRoute } from "next";
import { getAllPosts, isLowQualityPost } from "@/lib/blog";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

// Run at request time — keeps the filesystem reads + Prisma query out of the
// build step, so missing env vars during build can't bake an empty sitemap.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

// ── Sitemap index strategy ──────────────────────────────────────────────────
// We split the sitemap into a tiered index so Google can prioritise the
// crawl budget on our strongest content while still discovering the long
// tail.  Next.js's `generateSitemaps()` API auto-generates
// `/sitemap.xml` as the index that lists each child sitemap below.
//
//   /sitemap/0.xml  — TOP TIER       (statics + products + top 100 per locale)
//   /sitemap/1.xml  — EN long tail   (EN posts ranked 101+, non-low-quality)
//   /sitemap/2.xml  — ZH long tail   (ZH posts ranked 101+, non-low-quality)
//
// Low-quality posts (content < LOW_QUALITY_THRESHOLD) are excluded from
// every child sitemap and are also marked `noindex` on their detail page.

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }];
}

// Next.js 16 made the sitemap function args async (mirroring the
// `params` / `searchParams` change). `id` arrives as a Promise<number>,
// not a number — old code that did `Number(id)` got `NaN` and every
// branch fell through to the fallback. Always await first.
export default async function sitemap({
  id,
}: {
  id: Promise<number> | number;
}): Promise<MetadataRoute.Sitemap> {
  const resolvedId = await Promise.resolve(id);
  const n = Number(resolvedId);

  try {
    if (n === 0) return await topTierSitemap();
    if (n === 1) return enLongTailSitemap();
    if (n === 2) return zhLongTailSitemap();
  } catch (err) {
    console.error("[sitemap] generation threw", err);
  }

  // Fallback so /sitemap/0.xml never returns a fully-empty urlset even
  // if Prisma / fs / etc. blow up at request time. The first URL bakes
  // in the deploy fingerprint (commit SHA + id we received) so we can
  // tell which build is actually serving when debugging cache layers.
  const now = new Date();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || "local";
  return [
    {
      url: `${SITE_URL}/?_sitemap_fallback=sha:${sha}_id:${resolvedId}_n:${n}`,
      lastModified: now,
    },
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/zh/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/press`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}

// Helper: wraps a sync producer so any throw becomes a debug URL we can
// see in the live sitemap (instead of the entry just being missing).
function safeUrls(
  label: string,
  producer: () => MetadataRoute.Sitemap,
): MetadataRoute.Sitemap {
  try {
    return producer();
  } catch (err) {
    console.error(`[sitemap] ${label} failed`, err);
    const msg = err instanceof Error ? err.message : String(err);
    return [
      {
        url: `${SITE_URL}/?_sitemap_debug=${label}:${encodeURIComponent(msg.slice(0, 120))}`,
        lastModified: new Date(),
      },
    ];
  }
}

// ── ID 0: Top tier ──────────────────────────────────────────────────────────
async function topTierSitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const heroImage = `${SITE_URL}/images/pptx/aibox-sg8.png`;
  const absUrl = (path: string) =>
    /^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  // Static landing pages — always emit these even if everything below
  // explodes, so the sitemap never goes below the minimum.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0, images: [heroImage] },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/blog/all`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/zh/blog`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/zh/blog/all`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/press`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/zh/press`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/zh/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true, image: true },
      orderBy: { createdAt: "asc" },
    });
    productEntries = products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      images: [absUrl(p.image || heroImage)],
    }));
  } catch (err) {
    console.error("[sitemap] prisma.product.findMany failed", err);
  }

  // ALL product-channel posts (not just top 100) go in the top tier at high
  // priority — this is the content we want crawled first.
  const enBrand = safeUrls("en-brand", () =>
    brandPosts("en").map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  );

  const zhBrand = safeUrls("zh-brand", () =>
    brandPosts("zh").map((post) => ({
      url: `${SITE_URL}/zh/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  );

  return [...staticEntries, ...productEntries, ...enBrand, ...zhBrand];
}

// ── ID 1: EN filler long tail (non-product channels) ────────────────────────
function enLongTailSitemap(): MetadataRoute.Sitemap {
  return safeUrls("en-rest", () =>
    nonBrandPosts("en").map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  );
}

// ── ID 2: ZH filler long tail (non-product channels) ────────────────────────
function zhLongTailSitemap(): MetadataRoute.Sitemap {
  return safeUrls("zh-rest", () =>
    nonBrandPosts("zh").map((post) => ({
      url: `${SITE_URL}/zh/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  );
}

// ── Channel-aware ranking ───────────────────────────────────────────────────
// szxinmai (深圳信迈's own CSDN) and ARM_FPGA_AI are Sienovo's product content —
// the SEO asset. yeyuangen is a third-party programmer's blog we mirror for the
// long tail. We put the product channels in the top-tier sitemap at high
// priority so Google spends crawl budget there first, and demote the filler.
function isBrandChannel(post: { source?: string }): boolean {
  return /\/(szxinmai|ARM_FPGA_AI)\//i.test(post.source || "");
}

function brandPosts(locale: "en" | "zh") {
  return getAllPosts(locale)
    .filter((post) => !isLowQualityPost(post) && isBrandChannel(post))
    .sort((a, b) => (b.content?.length ?? 0) - (a.content?.length ?? 0));
}

function nonBrandPosts(locale: "en" | "zh") {
  return getAllPosts(locale)
    .filter((post) => !isLowQualityPost(post) && !isBrandChannel(post))
    .sort((a, b) => (b.content?.length ?? 0) - (a.content?.length ?? 0));
}
