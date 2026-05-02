import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

// Run at request time — keeps the filesystem reads + Prisma query out of the
// build step, so missing env vars during build can't bake an empty sitemap.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static landing pages
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/en/blog`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
  ];

  // Products — non-fatal on DB error so a Prisma outage can't 500 the sitemap.
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });
    productEntries = products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.error("[sitemap] prisma.product.findMany failed", err);
  }

  // Blog posts (Chinese + English) — read straight from the MDX files.
  const zhPosts = getAllPosts("zh").map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const enPosts = getAllPosts("en").map((post) => ({
    url: `${SITE_URL}/en/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...productEntries, ...zhPosts, ...enPosts];
}
