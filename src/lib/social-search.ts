import { trackApiUsage } from "./api-usage";

export type Platform = "xiaohongshu" | "weixin" | "both";
export type SearchType = "competitor" | "buyer" | "kol" | "keyword";

export interface SocialSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string; // e.g. "微信公众号", "小红书引用"
  platform: "xiaohongshu" | "weixin";
  author?: string;
}

// Industry keywords related to Sienovo's products
const INDUSTRY_TERMS = [
  "工业AI", "边缘计算", "视觉检测", "智能制造", "工业相机",
  "缺陷检测", "质量检测", "机器视觉", "AI盒子", "边缘AI",
  "安防监控", "智慧工厂", "工业自动化",
];

function buildQuery(keywords: string, type: SearchType): string {
  switch (type) {
    case "competitor":
      return `${keywords} (${INDUSTRY_TERMS.slice(0, 4).join(" OR ")})`;
    case "buyer":
      return `${keywords} (工厂 OR 生产线 OR 仓库 OR 制造业 OR 采购)`;
    case "kol":
      return `${keywords} (测评 OR 推荐 OR 分享 OR 博主 OR 达人)`;
    case "keyword":
    default:
      return keywords;
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
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });

    if (!res.ok) return [];
    const html = await res.text();

    // Parse article blocks from Sogou HTML
    const results: SocialSearchResult[] = [];
    const blocks = html.split(/<li id="sogou_vr_/).slice(1); // split by result items

    for (const block of blocks.slice(0, num)) {
      // Extract title + URL from <h3><a>
      const titleMatch = block.match(
        /<h3>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
      );
      if (!titleMatch) continue;

      const articleUrl = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]*>/g, "").trim();

      // Extract snippet from <p class="txt-info">
      const snippetMatch = block.match(
        /<p class="txt-info">([\s\S]*?)<\/p>/
      );
      const snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]*>/g, "").trim()
        : "";

      // Extract author (公众号名)
      const authorMatch = block.match(
        /account="([^"]*)"/
      ) || block.match(/<a[^>]*class="account"[^>]*>([\s\S]*?)<\/a>/);
      const author = authorMatch
        ? (authorMatch[1] || authorMatch[2] || "").replace(/<[^>]*>/g, "").trim()
        : "";

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

// --- Serper Google 搜索 (小红书间接内容) ---
async function searchGoogleForPlatform(
  platformKeyword: string,
  query: string,
  platformTag: "xiaohongshu" | "weixin",
  num: number = 10
): Promise<SocialSearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return [];

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${platformKeyword} ${query}`,
        num,
        gl: "cn",
        hl: "zh-cn",
      }),
    });

    if (!res.ok) {
      await trackApiUsage("serper", "social_search", false);
      return [];
    }

    await trackApiUsage("serper", "social_search", true);
    const data = await res.json();

    return (data.organic || [])
      .map((item: { title: string; snippet: string; link: string }) => ({
        title: (item.title || "").replace(/<[^>]*>/g, ""),
        snippet: (item.snippet || "").replace(/<[^>]*>/g, ""),
        url: item.link || "",
        source: platformTag === "xiaohongshu" ? "小红书相关" : "视频号相关",
        platform: platformTag,
      }))
      .filter((r: SocialSearchResult) => r.title);
  } catch {
    return [];
  }
}

export async function searchSocialPlatform(
  platform: Platform,
  keywords: string,
  type: SearchType,
  num: number = 10
): Promise<SocialSearchResult[]> {
  const query = buildQuery(keywords, type);
  const results: SocialSearchResult[] = [];
  const perPlatform = platform === "both" ? Math.ceil(num / 2) : num;

  // 微信: 搜狗微信搜索 (primary) + Google fallback
  if (platform === "weixin" || platform === "both") {
    const sogouResults = await searchSogouWeixin(query, perPlatform);
    results.push(...sogouResults);

    // If Sogou returns few results, supplement with Google
    if (sogouResults.length < 3) {
      const googleResults = await searchGoogleForPlatform(
        "微信公众号 OR 视频号",
        query,
        "weixin",
        perPlatform - sogouResults.length
      );
      results.push(...googleResults);
    }
  }

  // 小红书: Google search with 小红书 keyword (since XHS blocks direct scraping)
  if (platform === "xiaohongshu" || platform === "both") {
    const xhsResults = await searchGoogleForPlatform(
      "小红书",
      query,
      "xiaohongshu",
      perPlatform
    );
    results.push(...xhsResults);
  }

  return results;
}
