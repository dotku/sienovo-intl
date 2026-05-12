import Link from "next/link";
import type { BlogPost, BlogLocale } from "@/lib/blog";

export default function RelatedPosts({
  posts,
  locale,
}: {
  posts: BlogPost[];
  locale: BlogLocale;
}) {
  if (posts.length === 0) return null;
  const heading = locale === "zh" ? "相关文章" : "Related Articles";
  const base = locale === "zh" ? "/zh/blog" : "/blog";

  return (
    <aside className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{heading}</h2>
      <ul className="divide-y divide-gray-100 border-t border-b border-gray-100">
        {posts.map((p) => (
          <li key={p.slug} className="py-3">
            <Link
              href={`${base}/${p.slug}`}
              className="group flex flex-col gap-1"
            >
              <span className="text-base font-medium text-gray-900 group-hover:text-accent transition-colors">
                {p.title}
              </span>
              {p.tags.length > 0 && (
                <span className="text-xs text-gray-400">
                  {p.tags.slice(0, 4).join(" · ")}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
