import { getAllPosts, isLowQualityPost, type BlogLocale, type BlogPost } from "./blog";
import { SITE_URL } from "./site";

const FEED_SIZE = 50;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function summary(post: BlogPost, maxLen = 300): string {
  if (post.seoDescription) return post.seoDescription;
  // Strip frontmatter remnants and markdown; take first paragraph or two.
  const plain = post.content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}

export function buildRssFeed(locale: BlogLocale): string {
  const posts = getAllPosts(locale)
    .filter((p) => !isLowQualityPost(p))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, FEED_SIZE);

  const basePath = locale === "en" ? "/blog" : "/zh/blog";
  const feedUrl = `${SITE_URL}${locale === "en" ? "/rss.xml" : "/zh/rss.xml"}`;
  const channelTitle =
    locale === "en"
      ? "Sienovo · Edge AI Computing Insights"
      : "Sienovo · 边缘 AI 计算行业洞察";
  const channelDesc =
    locale === "en"
      ? "Industrial video analytics, edge AI, and computer vision articles from Sienovo."
      : "工业视频分析、边缘 AI 与机器视觉相关的中文长文。";
  const lang = locale === "en" ? "en-US" : "zh-CN";

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}${basePath}/${post.slug}`;
      const pubDate = new Date(post.date || Date.now()).toUTCString();
      const desc = esc(summary(post));
      const title = esc(post.seoTitle || post.title);
      const categories = (post.tags || [])
        .map((t) => `      <category>${esc(t)}</category>`)
        .join("\n");
      return `    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
${categories}
    </item>`;
    })
    .join("\n");

  const lastBuild = new Date().toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(channelTitle)}</title>
    <link>${SITE_URL}${basePath}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <description>${esc(channelDesc)}</description>
    <language>${lang}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
