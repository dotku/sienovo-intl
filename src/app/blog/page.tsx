import Link from "next/link";
import { getPaginatedPosts } from "@/lib/blog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Blog | Sienovo",
  description:
    "Technical articles on embedded systems, edge AI, FPGA, ARM platforms, and industrial computing solutions.",
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
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Blog
            </h1>
            <p className="text-gray-500">
              {totalPosts} articles on embedded systems, edge AI, and industrial
              computing
            </p>
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
