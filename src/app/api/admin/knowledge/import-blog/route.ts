import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { getAllPosts, getPostBySlug, type BlogLocale } from "@/lib/blog";
import { indexKnowledgeArticle } from "@/lib/rag/index-article";

export const maxDuration = 300;

async function translateToEnglish(title: string, content: string): Promise<{ title: string; content: string }> {
  // Provider chain: Z.AI (free) → DeepSeek (cheap) → Cerebras (fallback)
  const providers = [
    process.env.ZAI_API_KEY && {
      name: "zai",
      url: "https://api.z.ai/api/paas/v4/chat/completions",
      key: process.env.ZAI_API_KEY,
      model: "GLM-4.7-Flash",
      maxTokensKey: "max_tokens",
    },
    process.env.DEEPSEEK_API_KEY && {
      name: "deepseek",
      url: "https://api.deepseek.com/chat/completions",
      key: process.env.DEEPSEEK_API_KEY,
      model: "deepseek-chat",
      maxTokensKey: "max_tokens",
    },
    process.env.CEREBRAS_API_KEY && {
      name: "cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: process.env.CEREBRAS_API_KEY,
      model: "qwen-3-235b-a22b-instruct-2507",
      maxTokensKey: "max_completion_tokens",
    },
  ].filter(Boolean) as Array<{ name: string; url: string; key: string; model: string; maxTokensKey: string }>;

  if (providers.length === 0) return { title, content };

  const prompt = `Translate this Chinese technical blog post to English. Keep code blocks, URLs, and technical terms unchanged. Return ONLY the translated text, nothing else.\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 12000)}`;

  for (const provider of providers) {
    try {
      const body: Record<string, unknown> = {
        model: provider.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      };
      body[provider.maxTokensKey] = 8192;

      const res = await fetch(provider.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;

      const data = await res.json();
      const translated = data.choices?.[0]?.message?.content || "";
      if (!translated) continue;

      const lines = translated.split("\n").filter((l: string) => l.trim());
      const translatedTitle = lines[0]?.replace(/^#+\s*/, "").replace(/^Title:\s*/i, "") || title;
      return { title: translatedTitle, content: translated };
    } catch {
      continue;
    }
  }

  return { title, content };
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const locale = (body.locale as BlogLocale) || "zh";
  const batchSize = body.batchSize || 20;
  const translate = body.translate !== false;
  const autoIndex = body.autoIndex !== false;

  const posts = getAllPosts(locale);
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let indexed = 0;
  let translated = 0;

  const batch = posts.slice(0, batchSize);

  for (const post of batch) {
    const full = getPostBySlug(post.slug, locale);
    if (!full?.content) { unchanged++; continue; }

    const slug = `blog-${locale}-${post.slug}`;

    // Check if already imported
    const existing = await prisma.knowledgeArticle.findFirst({
      where: { category: slug },
    });

    if (existing) {
      if (existing.content === full.content && existing.title === post.title) {
        unchanged++;
        continue;
      }
      await prisma.knowledgeArticle.update({
        where: { id: existing.id },
        data: { title: post.title, content: full.content, indexStatus: "pending" },
      });
      updated++;
      if (autoIndex) {
        try { await indexKnowledgeArticle(existing.id); indexed++; } catch {}
      }
    } else {
      // Translate if Chinese
      let title = post.title;
      let content = full.content;
      if (translate && locale === "zh") {
        const t = await translateToEnglish(title, content);
        // Save both: original as zh article, translated as en article
        await prisma.knowledgeArticle.create({
          data: { title, content, category: slug },
        });

        const enSlug = `blog-en-${post.slug}`;
        const enExisting = await prisma.knowledgeArticle.findFirst({ where: { category: enSlug } });
        if (!enExisting) {
          const enArticle = await prisma.knowledgeArticle.create({
            data: { title: t.title, content: t.content, category: enSlug },
          });
          if (autoIndex) {
            try { await indexKnowledgeArticle(enArticle.id); indexed++; } catch {}
          }
          translated++;
        }
        created++;
        continue;
      }

      const article = await prisma.knowledgeArticle.create({
        data: { title, content, category: slug },
      });
      created++;

      if (autoIndex) {
        try { await indexKnowledgeArticle(article.id); indexed++; } catch {}
      }
    }
  }

  return NextResponse.json({
    created,
    updated,
    unchanged,
    indexed,
    translated,
    processed: batch.length,
    total: posts.length,
    remaining: Math.max(0, posts.length - batchSize),
  });
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const articleCount = await prisma.knowledgeArticle.count();
  const indexedCount = await prisma.knowledgeArticle.count({ where: { indexStatus: "indexed" } });
  const pendingCount = await prisma.knowledgeArticle.count({ where: { indexStatus: "pending" } });

  return NextResponse.json({ articles: articleCount, indexed: indexedCount, pending: pendingCount });
}
