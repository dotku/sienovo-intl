import { getAllPosts } from "@/lib/blog";

export async function GET() {
  const posts = getAllPosts();
  const siteUrl = "https://sienovo-intl.vercel.app";

  const items = posts
    .slice(0, 50)
    .map(
      (post) => `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}/blog/${post.slug}</link>
      <guid>${siteUrl}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.content.substring(0, 300).replace(/[<>]/g, "")}...]]></description>
    </item>`
    )
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sienovo Blog</title>
    <link>${siteUrl}/blog</link>
    <description>Technical articles on embedded systems, edge AI, FPGA, ARM platforms, and industrial computing solutions.</description>
    <language>zh-cn</language>
    <atom:link href="${siteUrl}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
