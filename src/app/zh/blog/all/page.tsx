import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAllPosts, isLowQualityPost } from "@/lib/blog";

export const metadata = {
  title: "全部文章 · Sienovo 博客归档",
  description:
    "Sienovo 技术博客全部文章归档，涵盖边缘 AI、嵌入式系统、FPGA、ARM 平台与工业计算。",
  alternates: {
    canonical: "/zh/blog/all",
    languages: {
      en: "/blog/all",
      zh: "/zh/blog/all",
    },
  },
};

export default function ZhBlogAllPage() {
  const posts = getAllPosts("zh").filter((p) => !isLowQualityPost(p));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">全部文章</h1>
          <p className="text-gray-500 mb-8">
            完整归档 · {posts.length} 篇 · 按日期排序
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
                  href={`/zh/blog/${post.slug}`}
                  className="text-gray-700 hover:text-accent hover:underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-gray-400">
            想看分页版？
            <Link href="/zh/blog" className="text-accent hover:underline">
              返回 /zh/blog
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
