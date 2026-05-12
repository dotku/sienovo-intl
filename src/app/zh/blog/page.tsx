import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogList from "@/components/BlogList";

export const metadata = {
  title: "技术博客 - 嵌入式系统、边缘 AI 与工业计算 | Sienovo",
  description:
    "Sienovo 关于嵌入式系统、边缘 AI、FPGA、ARM 平台与工业计算解决方案的技术文章。",
  alternates: {
    canonical: "/zh/blog",
    languages: {
      en: "/blog",
      zh: "/zh/blog",
    },
  },
};

export default async function ZhBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        <BlogList locale="zh" page={page} />
      </main>
      <Footer />
    </>
  );
}
