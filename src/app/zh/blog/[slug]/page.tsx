import { notFound } from "next/navigation";
import {
  getAllPosts,
  getPostBySlug,
  getRelatedPosts,
  isLowQualityPost,
} from "@/lib/blog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogArticle from "@/components/BlogArticle";
import RelatedPosts from "@/components/RelatedPosts";
import { SITE_URL } from "@/lib/site";

const OG_IMAGE = `${SITE_URL}/images/pptx/aibox-sg8.png`;

function buildDescription(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export async function generateStaticParams() {
  return getAllPosts("zh").map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug, "zh");
  if (!post) return { title: "Not Found" };

  const description = post.seoDescription || buildDescription(post.content);
  const title = post.seoTitle || post.title;
  const url = `${SITE_URL}/zh/blog/${slug}`;
  const enExists = !!getPostBySlug(slug, "en");
  const lowQuality = isLowQualityPost(post);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      ...(enExists && {
        languages: {
          en: `${SITE_URL}/blog/${slug}`,
          zh: url,
        },
      }),
    },
    robots: lowQuality
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "Sienovo",
      locale: "zh_CN",
      publishedTime: post.date,
      tags: post.tags,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

export default async function ZhBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug, "zh");
  if (!post) notFound();

  const description = post.seoDescription || buildDescription(post.content);
  const url = `${SITE_URL}/zh/blog/${slug}`;
  const lowQuality = isLowQualityPost(post);
  const articleJsonLd = lowQuality ? null : {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    image: OG_IMAGE,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "Sienovo" },
    publisher: {
      "@type": "Organization",
      name: "Sienovo",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/pptx/aibox-sg8.png`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.tags.join(", "),
    inLanguage: "zh-CN",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "博客", item: `${SITE_URL}/zh/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  return (
    <>
      {articleJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Header />
      <main className="min-h-screen bg-white">
        <BlogArticle post={post} locale="zh" />
        <RelatedPosts posts={getRelatedPosts(post, "zh", 4)} locale="zh" />
      </main>
      <Footer />
    </>
  );
}
