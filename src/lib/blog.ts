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
  };
}

export function getAllTags(locale: BlogLocale = "zh"): string[] {
  const posts = getAllPosts(locale);
  const tagSet = new Set<string>();
  posts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
  return [...tagSet].sort();
}

export const POSTS_PER_PAGE = 20;

export function getPaginatedPosts(page: number, locale: BlogLocale = "zh") {
  const all = getAllPosts(locale);
  const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);
  const start = (page - 1) * POSTS_PER_PAGE;
  const posts = all.slice(start, start + POSTS_PER_PAGE);
  return { posts, totalPages, currentPage: page, totalPosts: all.length };
}
