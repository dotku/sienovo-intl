import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import type { BlogPost, BlogLocale } from "@/lib/blog";

export default function BlogArticle({
  post,
  locale,
}: {
  post: BlogPost;
  locale: BlogLocale;
}) {
  const backHref = locale === "en" ? "/en/blog" : "/blog";

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back link */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-accent transition-colors mb-8"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Blog
      </Link>

      {/* Header */}
      <header className="mb-8">
        <time className="text-sm text-gray-400 font-mono">{post.date}</time>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
          {post.title}
        </h1>
        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-img:rounded-lg prose-img:border prose-img:border-gray-200 prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
        <MDXRemote
          source={post.content}
          options={{ mdxOptions: { format: "md" } }}
        />
      </div>

      {/* Source link */}
      {post.source && (
        <div className="mt-12 pt-6 border-t border-gray-100">
          <a
            href={post.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-accent transition-colors"
          >
            View original article on CSDN →
          </a>
        </div>
      )}
    </article>
  );
}
