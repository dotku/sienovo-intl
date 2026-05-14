import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAllPosts, isLowQualityPost } from "@/lib/blog";

export const metadata = {
  title: "All Articles · Sienovo Blog Archive",
  description:
    "Complete archive of Sienovo technical articles on edge AI, embedded systems, FPGA, ARM platforms, and industrial computing.",
  alternates: {
    canonical: "/blog/all",
    languages: {
      en: "/blog/all",
      zh: "/zh/blog/all",
    },
  },
};

// Dense single-page "HTML sitemap" — exposes every substantive article as a
// plain link so Google's crawler reaches all 100 in one hop from /blog/all,
// rather than walking through 5 pages of pagination. Pure crawl-discovery aid.
export default function BlogAllPage() {
  const posts = getAllPosts("en").filter((p) => !isLowQualityPost(p));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            All Articles
          </h1>
          <p className="text-gray-500 mb-8">
            Complete archive · {posts.length} articles · sorted by date
          </p>
          <ul className="space-y-1.5">
            {posts.map((post) => (
              <li key={post.slug} className="flex items-baseline gap-3">
                <time
                  dateTime={post.date}
                  className="text-xs text-gray-400 font-mono shrink-0 w-20"
                >
                  {post.date.slice(0, 10)}
                </time>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-gray-700 hover:text-accent hover:underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-gray-400">
            Looking for paginated view?{" "}
            <Link href="/blog" className="text-accent hover:underline">
              Return to /blog
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
