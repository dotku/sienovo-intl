import { trackApiUsage } from "./api-usage";

// Decode HTML entities like &ldquo; &hellip; &amp; etc
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

// Clean sogou redirect URLs to be shorter/readable
function cleanSogouUrl(url: string): string {
  // Sogou wraps real URLs in /link?url=... Remove &amp; artifacts
  return url.replace(/&amp;/g, "&");
}

export type Platform =
  | "xiaohongshu" | "weixin"
  | "linkedin" | "youtube" | "reddit" | "twitter" | "tiktok"
  | "all_cn" | "all_global" | "all";

export type SearchType = "competitor" | "buyer" | "kol" | "keyword";

export interface SocialSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
  platform: string;
  author?: string;
}

interface PlatformConfig {
  siteDomain: string;
  label: string;
  gl?: string;
  hl?: string;
}

const PLATFORMS: Record<string, PlatformConfig> = {
  // Chinese platforms
  xiaohongshu: { siteDomain: "", label: "小红书相关", gl: "cn", hl: "zh-cn" }, // no site: (Google can't index XHS)
  weixin: { siteDomain: "", label: "微信公众号", gl: "cn", hl: "zh-cn" }, // uses Sogou
  // Global platforms
  linkedin: { siteDomain: "linkedin.com", label: "LinkedIn" },
  youtube: { siteDomain: "youtube.com", label: "YouTube" },
  reddit: { siteDomain: "reddit.com", label: "Reddit" },
  twitter: { siteDomain: "x.com", label: "X (Twitter)" },
  tiktok: { siteDomain: "tiktok.com", label: "TikTok" },
};

const CN_PLATFORMS = ["xiaohongshu", "weixin"];
const GLOBAL_PLATFORMS = ["linkedin", "youtube", "reddit", "twitter", "tiktok"];

const INDUSTRY_TERMS_CN = ["工业AI", "边缘计算", "视觉检测", "智能制造", "机器视觉"];
const INDUSTRY_TERMS_EN = ["edge AI", "industrial vision", "defect detection", "smart manufacturing", "machine vision"];

function buildQuery(keywords: string, type: SearchType, isEnglish: boolean): string {
  const terms = isEnglish ? INDUSTRY_TERMS_EN : INDUSTRY_TERMS_CN;
  switch (type) {
    case "competitor":
      return `${keywords} (${terms.slice(0, 3).join(" OR ")})`;
    case "buyer":
      return isEnglish
        ? `${keywords} (factory OR production OR warehouse OR manufacturing OR procurement)`
        : `${keywords} (工厂 OR 生产线 OR 仓库 OR 制造业 OR 采购)`;
    case "kol":
      return isEnglish
        ? `${keywords} (review OR tutorial OR comparison OR guide)`
        : `${keywords} (测评 OR 推荐 OR 分享 OR 博主 OR 达人)`;
    case "keyword":
    default:
      return keywords;
  }
}

// --- Serper Google site: search (works great for global platforms) ---
async function searchGoogleSite(
  siteDomain: string,
  query: string,
  label: string,
  platformKey: string,
  num: number = 10,
  gl?: string,
  hl?: string
): Promise<SocialSearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return [];

  try {
    const q = siteDomain ? `site:${siteDomain} ${query}` : query;
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q, num, gl: gl || "us", hl: hl || "en" }),
    });

    if (!res.ok) {
      await trackApiUsage("serper", "social_search", false);
      return [];
    }

    await trackApiUsage("serper", "social_search", true);
    const data = await res.json();

    return (data.organic || [])
      .map((item: { title: string; snippet: string; link: string }) => ({
        title: decodeHtmlEntities((item.title || "").replace(/<[^>]*>/g, "")),
        snippet: decodeHtmlEntities((item.snippet || "").replace(/<[^>]*>/g, "")),
        url: item.link || "",
        source: label,
        platform: platformKey,
      }))
      .filter((r: SocialSearchResult) => r.title);
  } catch {
    return [];
  }
}

// --- 搜狗微信搜索 (公众号文章) ---
async function searchSogouWeixin(
  query: string,
  num: number = 10
): Promise<SocialSearchResult[]> {
  try {
    const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}&ie=utf8`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });

    if (!res.ok) return [];
    const html = await res.text();

    const results: SocialSearchResult[] = [];
    const blocks = html.split(/<li id="sogou_vr_/).slice(1);

    for (const block of blocks.slice(0, num)) {
      const titleMatch = block.match(/<h3>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;

      const articleUrl = cleanSogouUrl(titleMatch[1]);
      const title = decodeHtmlEntities(titleMatch[2].replace(/<[^>]*>/g, "").trim());

      // Try multiple snippet patterns
      const snippetMatch = block.match(/<p class="txt-info">([\s\S]*?)<\/p>/)
        || block.match(/<p class="txt_info">([\s\S]*?)<\/p>/)
        || block.match(/<p[^>]*class="[^"]*info[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      const snippet = snippetMatch
        ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]*>/g, "").trim())
        : "";

      const authorMatch = block.match(/account="([^"]*)"/)
        || block.match(/<a[^>]*class="account"[^>]*>([\s\S]*?)<\/a>/);
      let author = authorMatch
        ? decodeHtmlEntities((authorMatch[1] || authorMatch[2] || "").replace(/<[^>]*>/g, "").trim())
        : "";
      // Strip JS artifacts like document.write(timeConvert('...'))
      if (author.includes("document.write") || author.includes("timeConvert")) author = "";

      if (title) {
        results.push({
          title,
          snippet,
          url: articleUrl.startsWith("http") ? articleUrl : `https://weixin.sogou.com${articleUrl}`,
          source: "微信公众号",
          platform: "weixin",
          author,
        });
      }
    }

    if (results.length > 0) {
      await trackApiUsage("serper", "sogou_weixin_search", true);
    }
    return results;
  } catch {
    return [];
  }
}

// --- 搜狗通用搜索 (for Chinese platforms without dedicated search) ---
async function searchSogouWeb(
  query: string,
  platformKey: string,
  label: string,
  num: number = 10
): Promise<SocialSearchResult[]> {
  try {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}&ie=utf8`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });

    if (!res.ok) return [];
    const html = await res.text();

    const results: SocialSearchResult[] = [];
    const h3Links = [...html.matchAll(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/g)];

    for (const match of h3Links.slice(0, num)) {
      const title = decodeHtmlEntities(match[2].replace(/<[^>]*>/g, "").trim());
      const linkUrl = cleanSogouUrl(match[1]);
      if (!title) continue;

      // Extract snippet from the content after this h3 block
      const matchPos = html.indexOf(match[0]);
      const afterH3 = html.slice(matchPos + match[0].length, matchPos + match[0].length + 800);
      const snippetMatch = afterH3.match(/<p[^>]*>([\s\S]*?)<\/p>/)
        || afterH3.match(/<div class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const snippet = snippetMatch
        ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]*>/g, "").trim()).slice(0, 200)
        : "";

      results.push({
        title,
        snippet,
        url: linkUrl.startsWith("http") ? linkUrl : `https://www.sogou.com${linkUrl}`,
        source: label,
        platform: platformKey,
      });
    }

    if (results.length > 0) {
      await trackApiUsage("serper", "sogou_web_search", true);
    }
    return results;
  } catch {
    return [];
  }
}

// --- Main search function ---
export async function searchSocialPlatform(
  platform: Platform,
  keywords: string,
  type: SearchType,
  num: number = 10
): Promise<SocialSearchResult[]> {
  // Determine which platforms to search
  let platformKeys: string[];
  if (platform === "all") {
    platformKeys = [...CN_PLATFORMS, ...GLOBAL_PLATFORMS];
  } else if (platform === "all_cn") {
    platformKeys = CN_PLATFORMS;
  } else if (platform === "all_global") {
    platformKeys = GLOBAL_PLATFORMS;
  } else {
    platformKeys = [platform];
  }

  const perPlatform = Math.max(3, Math.ceil(num / platformKeys.length));
  const results: SocialSearchResult[] = [];

  for (const key of platformKeys) {
    const isGlobal = GLOBAL_PLATFORMS.includes(key);
    const query = buildQuery(keywords, type, isGlobal);

    if (key === "weixin") {
      // Sogou Weixin search (dedicated WeChat search)
      const sogou = await searchSogouWeixin(query, perPlatform);
      results.push(...sogou);
      if (sogou.length < 2) {
        const fallback = await searchSogouWeb(`微信公众号 ${query}`, "weixin", "微信相关", perPlatform - sogou.length);
        results.push(...fallback);
      }
    } else if (key === "xiaohongshu") {
      // Sogou web search with 小红书 keyword
      const sogou = await searchSogouWeb(`小红书 ${query}`, "xiaohongshu", "小红书", perPlatform);
      results.push(...sogou);
    } else {
      // Global platforms: Google site: search
      const config = PLATFORMS[key];
      if (config) {
        const items = await searchGoogleSite(config.siteDomain, query, config.label, key, perPlatform);
        results.push(...items);
      }
    }
  }

  return results;
}
