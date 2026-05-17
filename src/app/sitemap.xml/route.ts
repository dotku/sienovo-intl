import { SITE_URL } from "@/lib/site";

/**
 * Explicit `/sitemap.xml` sitemapindex route.
 *
 * Why this exists: `src/app/sitemap.ts` uses `generateSitemaps()` to
 * split the sitemap into tiered children (`/sitemap/0.xml`, `/1.xml`,
 * `/2.xml`). Next.js 14+ does NOT auto-generate a `/sitemap.xml` index
 * for multi-sitemap setups — that URL just 404s. This route handler
 * emits the sitemapindex XML manually so Google Search Console + RSS
 * readers + the wider crawler ecosystem have the canonical entry point
 * they expect.
 *
 * Run at request time so child sitemap lastmod stays reasonably fresh
 * without rebuilding.
 */

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const CHILD_IDS = [0, 1, 2] as const;

export async function GET() {
  const now = new Date().toISOString();
  const entries = CHILD_IDS.map(
    (id) =>
      `  <sitemap>\n    <loc>${SITE_URL}/sitemap/${id}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`,
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
