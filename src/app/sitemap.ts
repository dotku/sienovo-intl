import { MetadataRoute } from "next";
import { getAllPosts, isIndexablePost, productRelevance } from "@/lib/blog";
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
//   /sitemap/0.xml  — statics + products + the more product-relevant half of
//                     the indexable EN posts
//   /sitemap/1.xml  — the rest of the indexable EN posts
//   /sitemap/2.xml  — ZH static pages (contact, press)
//
// Only posts that pass isIndexablePost() (lib/blog) are listed — the same
// rule that sets index/noindex on the post page, so the sitemap never lists a
// noindex URL. ZH blog posts are CSDN copies and are never listed.

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
    { url: `${SITE_URL}/press`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
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

  const enTop = safeUrls("en-top", () => indexableEn().slice(0, TOP_TIER_SIZE).map(postEntry));

  return [...staticEntries, ...productEntries, ...enTop];
}

// ── ID 1: remaining indexable EN posts ──────────────────────────────────────
function enLongTailSitemap(): MetadataRoute.Sitemap {
  return safeUrls("en-rest", () => indexableEn().slice(TOP_TIER_SIZE).map(postEntry));
}

// ── ID 2: ZH static pages (ZH blog posts are noindex CSDN copies) ───────────
function zhLongTailSitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/zh/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/zh/press`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}

// ── Indexable EN posts, most product-relevant first ─────────────────────────
const TOP_TIER_SIZE = 170;

function indexableEn() {
  return getAllPosts("en")
    .filter((post) => isIndexablePost(post, "en"))
    .map((post) => ({ post, score: productRelevance(post) }))
    .sort((a, b) => b.score - a.score || (b.post.date > a.post.date ? 1 : -1));
}

function postEntry({ post, score }: { post: ReturnType<typeof getAllPosts>[number]; score: number }) {
  return {
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    // 0.5–0.8 by product relevance so the core product articles lead.
    priority: Math.round((0.5 + Math.min(score, 30) / 100) * 100) / 100,
  };
}
