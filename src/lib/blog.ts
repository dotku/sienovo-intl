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

// The CSDN sources were partly AI-written and carry citation residue: a
// zero-width non-joiner followed by a footnote number ("requirements\u200c1.")
// plus stray zero-width characters. Strip at read time so every page,
// excerpt and description is clean without rewriting thousands of files.
export function sanitizeContent(content: string): string {
  return content
    .replace(/\u200c\d{1,2}(?=[\s.,;:!?)\]，。；：！？）]|$)/gm, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "");
}

function getBlogDir(locale: BlogLocale = "zh"): string {
  return locale === "en" ? BLOG_EN_DIR : BLOG_DIR;
}

export function getAllPosts(locale: BlogLocale = "zh"): BlogPost[] {
  const dir = getBlogDir(locale);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  const posts = files
    .flatMap((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      // One malformed file (e.g. a NUL byte in AI-written frontmatter) must not
      // take down every page that lists posts — skip it and log.
      let parsed: matter.GrayMatterFile<string>;
      try {
        parsed = matter(raw);
      } catch (err) {
        console.error(`[blog] skipping unparsable ${locale}/${file}:`, (err as Error).message);
        return [];
      }
      const { data, content: rawContent } = parsed;
      const content = sanitizeContent(rawContent);
      return [{
        slug: data.slug || file.replace(/\.mdx$/, ""),
        title: data.title || "",
        date: data.date || "",
        tags: data.tags || [],
        source: data.source || "",
        content,
        originalTitle: data.originalTitle,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
      } as BlogPost];
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return posts;
}

export function getPostBySlug(slug: string, locale: BlogLocale = "zh"): BlogPost | null {
  const dir = getBlogDir(locale);
  const filePath = path.join(dir, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content: rawContent } = matter(raw);
  const content = sanitizeContent(rawContent);

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

// ── Indexing policy (2026-10-11) ───────────────────────────────────────────
// GSC showed ~3,200 blog URLs with almost nothing indexed: the ZH posts are
// verbatim CSDN copies (Google keeps the CSDN original) and the bulk of the EN
// long tail is machine-translated filler. We now let Google index only a
// curated EN set — Sienovo's own channels (which are product content by
// definition), 2019+, substantive — and serve everything else as
// noindex,follow (still reachable for readers, absent from the sitemap).
// productRelevance() only orders the sitemap; it doesn't exclude own posts.

// szxinmai (深圳信迈's own CSDN) and ARM_FPGA_AI are Sienovo's product content;
// yeyuangen is a third-party programmer's blog that was mirrored.
export function isBrandChannel(post: { source?: string }): boolean {
  return /\/(szxinmai|ARM_FPGA_AI)\//i.test(post.source || "");
}

const PRODUCT_TERMS: RegExp[] = [
  /rk35\d\d/, /rk3568|rk3576|rockchip/, /bm1684|sophon|sophgo/, /jetson|orin|nvidia/, /fpga/,
  /zynq|fmql|jfm|xilinx|kintex|artix/, /ethercat/, /edge (ai|computing|computer|box)/,
  /ai (box|computing|compute|inference|camera|vision)/, /npu|tops/, /robot/, /agv|amr/, /drone|uav/,
  /pcie/, /vpx/, /motion control|servo/, /machine vision|vision system|video analytics|video analysis/,
  /switch(ing)? (chip|core|board)|ctc7132|centec/, /industrial (pc|control|computer|automation)/,
  /codesys|plc/, /gmsl|camera module/, /marine|vessel|ship/,
  /intrusion|smart (city|surveillance)|surveillance|safety helmet|algorithm/, /qcm6125|qualcomm/,
  /loongson|phytium|domestic/, /real-time|rtos|xenomai/, /large model|llm|deepseek/,
];

/** Topical relevance to the product line: title/tag hits weigh 3, body hits 1. */
export function productRelevance(post: BlogPost): number {
  const head = `${post.title} ${post.tags.join(" ")}`.toLowerCase();
  const body = post.content.toLowerCase();
  return PRODUCT_TERMS.reduce((n, re) => n + (re.test(head) ? 3 : 0) + (re.test(body) ? 1 : 0), 0);
}

export const INDEXABLE = { minYear: 2019, minChars: 1000 };

/** Whether Google should index this post (and list it in the sitemap). */
export function isIndexablePost(post: BlogPost, locale: BlogLocale): boolean {
  if (locale !== "en") return false; // ZH posts are copies of the CSDN originals
  if (!isBrandChannel(post)) return false;
  if ((Number(post.date.slice(0, 4)) || 0) < INDEXABLE.minYear) return false;
  return (post.content?.length ?? 0) >= INDEXABLE.minChars;
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
