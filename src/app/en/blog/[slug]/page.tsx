import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogArticle from "@/components/BlogArticle";

export async function generateStaticParams() {
  return getAllPosts("en").map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug, "en");
  if (!post) return { title: "Not Found" };
  return {
    title: post.title,
    description: post.content.slice(0, 160).replace(/\n/g, " ").trim(),
  };
}

export default async function EnBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug, "en");
  if (!post) notFound();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <BlogArticle post={post} locale="en" />
      </main>
      <Footer />
    </>
  );
}
