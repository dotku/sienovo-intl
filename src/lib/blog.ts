import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");
const BLOG_EN_DIR = path.join(process.cwd(), "content/blog-en");

export type BlogLocale = "zh" | "en";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  source: string;
  content: string;
  originalTitle?: string;
  seoTitle?: string;
  seoDescription?: string;
}

function getBlogDir(locale: BlogLocale = "zh"): string {
  return locale === "en" ? BLOG_EN_DIR : BLOG_DIR;
}

export function getAllPosts(locale: BlogLocale = "zh"): BlogPost[] {
  const dir = getBlogDir(locale);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  const posts = files
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: data.slug || file.replace(/\.mdx$/, ""),
        title: data.title || "",
        date: data.date || "",
        tags: data.tags || [],
        source: data.source || "",
        content,
        originalTitle: data.originalTitle,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
      } as BlogPost;
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return posts;
}

export function getPostBySlug(slug: string, locale: BlogLocale = "zh"): BlogPost | null {
  const dir = getBlogDir(locale);
  const filePath = path.join(dir, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  return {
    slug: data.slug || slug,
    title: data.title || "",
    date: data.date || "",
    tags: data.tags || [],
    source: data.source || "",
    content,
    originalTitle: data.originalTitle,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
  };
}

// Posts shorter than this are stubs/link-only pages translated from CSDN —
// indexing them dilutes the site's quality signal and contributes to the
// "Discovered/Crawled - currently not indexed" GSC bucket. We still serve
// them at /blog/<slug> for users that follow direct links, but mark them
// noindex and exclude from the sitemap so Google focuses crawl budget on
// the substantive technical articles.
export const LOW_QUALITY_THRESHOLD = 500;

export function isLowQualityPost(post: BlogPost): boolean {
  return (post.content?.length ?? 0) < LOW_QUALITY_THRESHOLD;
}

// Pick up to `limit` substantive posts that share at least one tag with
// `post`, ranked by tag-overlap then content length. Used to render an
// internal-linking "Related posts" section on blog detail pages — the
// SEO checklist asks for 3-5 internal links per article, and this surfaces
// them automatically from existing tags rather than hand-curated maps.
export function getRelatedPosts(
  post: BlogPost,
  locale: BlogLocale,
  limit = 4
): BlogPost[] {
  if (!post.tags || post.tags.length === 0) return [];
  const tagSet = new Set(post.tags);
  return getAllPosts(locale)
    .filter(
      (p) =>
        p.slug !== post.slug &&
        !isLowQualityPost(p) &&
        p.tags.some((t) => tagSet.has(t))
    )
    .map((p) => ({
      post: p,
      overlap: p.tags.filter((t) => tagSet.has(t)).length,
    }))
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return (b.post.content?.length ?? 0) - (a.post.content?.length ?? 0);
    })
    .slice(0, limit)
    .map((x) => x.post);
}

export function getAllTags(locale: BlogLocale = "zh"): string[] {
  const posts = getAllPosts(locale);
  const tagSet = new Set<string>();
  posts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
  return [...tagSet].sort();
}

export const POSTS_PER_PAGE = 50;

export function getPaginatedPosts(page: number, locale: BlogLocale = "zh") {
  const all = getAllPosts(locale);
  const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);
  const start = (page - 1) * POSTS_PER_PAGE;
  const posts = all.slice(start, start + POSTS_PER_PAGE);
  return { posts, totalPages, currentPage: page, totalPosts: all.length };
}
