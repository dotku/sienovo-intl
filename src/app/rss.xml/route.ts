import { buildRssFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export function GET() {
  const xml = buildRssFeed("en");
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
