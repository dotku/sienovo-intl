import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  source: string;
  content: string;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  const posts = files
    .map((file) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: data.slug || file.replace(/\.mdx$/, ""),
        title: data.title || "",
        date: data.date || "",
        tags: data.tags || [],
        source: data.source || "",
        content,
      } as BlogPost;
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return posts;
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
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
  };
}

export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tagSet = new Set<string>();
  posts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
  return [...tagSet].sort();
}

export const POSTS_PER_PAGE = 20;

export function getPaginatedPosts(page: number) {
  const all = getAllPosts();
  const totalPages = Math.ceil(all.length / POSTS_PER_PAGE);
  const start = (page - 1) * POSTS_PER_PAGE;
  const posts = all.slice(start, start + POSTS_PER_PAGE);
  return { posts, totalPages, currentPage: page, totalPosts: all.length };
}
