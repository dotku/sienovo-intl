import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/dashboard/", "/auth/", "/login"],
      },
    ],
    // Point at the child sitemaps directly. Next's generateSitemaps() does not
    // serve a working /sitemap.xml index here (force-dynamic), so referencing
    // it would hand Google a 404 and hide all ~3k article URLs. robots.txt
    // accepts multiple Sitemap lines — list each child explicitly.
    sitemap: [
      `${SITE_URL}/sitemap/0.xml`,
      `${SITE_URL}/sitemap/1.xml`,
      `${SITE_URL}/sitemap/2.xml`,
    ],
    host: SITE_URL,
  };
}
