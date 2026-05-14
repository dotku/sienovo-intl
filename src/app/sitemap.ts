import { MetadataRoute } from "next";
import { getAllPosts, isLowQualityPost } from "@/lib/blog";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

// Run at request time — keeps the filesystem reads + Prisma query out of the
// build step, so missing env vars during build can't bake an empty sitemap.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // Blog posts — English at /blog (default), Chinese at /zh/blog.
  // Strategy: cap each locale at TOP_N posts ranked by content length, so the
  // sitemap stays small (~200 URLs total). New domain has very little crawl
  // budget; better to surface the strongest 100 per locale than dilute with
  // 1k+ thin/translated stubs that Google flags as "Discovered, not indexed".
  // Detail pages for filtered-out posts still exist (just not in sitemap),
  // and isLowQualityPost also drives `robots: noindex` on the page itself.
  const TOP_N = 100;
  const rankByLength = (a: { content?: string }, b: { content?: string }) =>
    (b.content?.length ?? 0) - (a.content?.length ?? 0);

  const enPosts = getAllPosts("en")
    .filter((post) => !isLowQualityPost(post))
    .sort(rankByLength)
    .slice(0, TOP_N)
    .map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

  const zhPosts = getAllPosts("zh")
    .filter((post) => !isLowQualityPost(post))
    .sort(rankByLength)
    .slice(0, TOP_N)
    .map((post) => ({
      url: `${SITE_URL}/zh/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  return [...staticEntries, ...productEntries, ...enPosts, ...zhPosts];
}
