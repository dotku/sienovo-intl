import Link from "next/link";
import { getPaginatedPosts } from "@/lib/blog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Technical Blog - Embedded Systems, Edge AI & Industrial Computing",
  description:
    "Technical articles on embedded systems, edge AI, FPGA, ARM platforms, and industrial computing solutions from Sienovo.",
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const { posts, totalPages, currentPage, totalPosts } =
    getPaginatedPosts(page);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Page header */}
          <div className="mb-10 flex items-start justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                Blog
              </h1>
              <p className="text-gray-500">
                {totalPosts} articles on embedded systems, edge AI, and industrial
                computing
              </p>
            </div>
            <a
              href="/blog/rss.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-accent transition-colors mt-2 shrink-0"
              title="RSS Feed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
              </svg>
              RSS
            </a>
          </div>

          {/* Article grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-lg border border-gray-200 p-6 hover:border-accent hover:shadow-md transition-all"
              >
                <time className="text-xs text-gray-400 font-mono">
                  {post.date}
                </time>
                <h2 className="mt-2 text-base font-semibold text-gray-900 group-hover:text-accent transition-colors line-clamp-3 leading-snug">
                  {post.title}
                </h2>
                {post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Empty state */}
          {posts.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              No articles yet. Check back soon!
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-12 flex items-center justify-center gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/blog?page=${currentPage - 1}`}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                >
                  Previous
                </Link>
              )}
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                // Show pages around current page
                let p: number;
                if (totalPages <= 10) {
                  p = i + 1;
                } else if (currentPage <= 5) {
                  p = i + 1;
                } else if (currentPage >= totalPages - 4) {
                  p = totalPages - 9 + i;
                } else {
                  p = currentPage - 4 + i;
                }
                return (
                  <Link
                    key={p}
                    href={`/blog?page=${p}`}
                    className={`px-3 py-2 text-sm rounded transition-colors ${
                      p === currentPage
                        ? "bg-accent text-white"
                        : "border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
              {currentPage < totalPages && (
                <Link
                  href={`/blog?page=${currentPage + 1}`}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
