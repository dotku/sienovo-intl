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

const TOP_N = 100;

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }];
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  if (id === 0) return topTierSitemap();
  if (id === 1) return enLongTailSitemap();
  if (id === 2) return zhLongTailSitemap();
  return [];
}

// ── ID 0: Top tier ──────────────────────────────────────────────────────────
async function topTierSitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const heroImage = `${SITE_URL}/images/pptx/aibox-sg8.png`;
  const absUrl = (path: string) =>
    /^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  // Static landing pages
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0, images: [heroImage] },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/blog/all`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/zh/blog`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/zh/blog/all`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
  ];

  // Products — non-fatal on DB error so a Prisma outage can't 500 the sitemap.
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

  const enTop = topPostsByLocale("en", 0, TOP_N).map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const zhTop = topPostsByLocale("zh", 0, TOP_N).map((post) => ({
    url: `${SITE_URL}/zh/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...productEntries, ...enTop, ...zhTop];
}

// ── ID 1: EN long tail (ranked 101+) ────────────────────────────────────────
function enLongTailSitemap(): MetadataRoute.Sitemap {
  return topPostsByLocale("en", TOP_N, Number.MAX_SAFE_INTEGER).map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));
}

// ── ID 2: ZH long tail (ranked 101+) ────────────────────────────────────────
function zhLongTailSitemap(): MetadataRoute.Sitemap {
  return topPostsByLocale("zh", TOP_N, Number.MAX_SAFE_INTEGER).map((post) => ({
    url: `${SITE_URL}/zh/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));
}

// ── Shared ranking + slicing ────────────────────────────────────────────────
function topPostsByLocale(locale: "en" | "zh", from: number, to: number) {
  return getAllPosts(locale)
    .filter((post) => !isLowQualityPost(post))
    .sort((a, b) => (b.content?.length ?? 0) - (a.content?.length ?? 0))
    .slice(from, to);
}
