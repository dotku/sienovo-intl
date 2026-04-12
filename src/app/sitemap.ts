import { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600; // regenerate sitemap every 1 hour

const SITE_URL = "https://sienovo-intl.jytech.us";
const POSTS_PER_SITEMAP = 500;

/**
 * Sitemap index — Next.js calls this to discover all sitemap IDs,
 * then calls sitemap({ id }) for each one.
 *
 * Layout:
 *   id 0  → static pages + product pages
 *   id 1… → Chinese blog posts  (batches of 500)
 *   id N… → English blog posts  (batches of 500)
 */
export async function generateSitemaps() {
  const zhCount = getAllPosts("zh").length;
  const enCount = getAllPosts("en").length;

  const zhChunks = Math.max(1, Math.ceil(zhCount / POSTS_PER_SITEMAP));
  const enChunks = Math.max(1, Math.ceil(enCount / POSTS_PER_SITEMAP));

  // id 0 = static + products, 1..zhChunks = zh blog, zhChunks+1.. = en blog
  const total = 1 + zhChunks + enChunks;
  return Array.from({ length: total }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  // ── id 0: static pages + products ──
  if (id === 0) {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });

    return [
      {
        url: SITE_URL,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
      {
        url: `${SITE_URL}/blog`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.8,
      },
      ...products.map((p) => ({
        url: `${SITE_URL}/products/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  }

  // ── Determine which blog chunk this id represents ──
  const zhPosts = getAllPosts("zh");
  const zhChunks = Math.max(1, Math.ceil(zhPosts.length / POSTS_PER_SITEMAP));

  if (id <= zhChunks) {
    // Chinese blog chunk (1-indexed: id 1 = first chunk)
    const chunkIndex = id - 1;
    const slice = zhPosts.slice(
      chunkIndex * POSTS_PER_SITEMAP,
      (chunkIndex + 1) * POSTS_PER_SITEMAP,
    );
    return slice.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  }

  // English blog chunk
  const enPosts = getAllPosts("en");
  const enChunkIndex = id - 1 - zhChunks;
  const slice = enPosts.slice(
    enChunkIndex * POSTS_PER_SITEMAP,
    (enChunkIndex + 1) * POSTS_PER_SITEMAP,
  );
  return slice.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}?lang=en`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}
