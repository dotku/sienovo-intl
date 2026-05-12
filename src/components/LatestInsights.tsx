import Link from "next/link";
import { getAllPosts, isLowQualityPost } from "@/lib/blog";

// Server component — surfaces 4 recent high-quality posts on the homepage so
// crawlers (and humans) have an obvious internal-link path from the landing
// page to the deep blog. Crawl-budget critical for new domains.
export default function LatestInsights({ locale = "en" as "en" | "zh" }) {
  const featured = getAllPosts(locale)
    .filter((p) => !isLowQualityPost(p))
    .sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0))
    .slice(0, 4);

  if (featured.length === 0) return null;

  const basePath = locale === "en" ? "/blog" : "/zh/blog";
  const heading = locale === "en" ? "Latest Insights" : "最新洞察";
  const sub =
    locale === "en"
      ? "Articles on industrial edge AI, computer vision and deployment."
      : "工业边缘 AI、计算机视觉与部署相关文章。";
  const viewAll = locale === "en" ? "View all articles →" : "查看全部 →";

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{heading}</h2>
            <p className="text-gray-600 mt-1">{sub}</p>
          </div>
          <Link
            href={basePath}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            {viewAll}
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featured.map((post) => (
            <Link
              key={post.slug}
              href={`${basePath}/${post.slug}`}
              className="group block rounded-lg border border-gray-200 p-5 hover:border-blue-500 hover:shadow-md transition"
            >
              {post.tags?.[0] && (
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">
                  {post.tags[0]}
                </div>
              )}
              <h3 className="text-base font-bold leading-snug text-gray-900 group-hover:text-blue-700 line-clamp-3">
                {post.title}
              </h3>
              {post.date && (
                <time
                  dateTime={post.date}
                  className="block text-xs text-gray-500 mt-3"
                >
                  {new Date(post.date).toLocaleDateString(
                    locale === "en" ? "en-US" : "zh-CN",
                    { year: "numeric", month: "short", day: "numeric" },
                  )}
                </time>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
