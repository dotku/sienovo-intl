import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth0";
import { getAllPosts, getPostBySlug, type BlogLocale } from "@/lib/blog";
import { indexKnowledgeArticle } from "@/lib/rag/index-article";

export const maxDuration = 300;

async function translateToEnglish(title: string, content: string): Promise<{ title: string; content: string }> {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) return { title, content };

  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "qwen-3-235b-a22b-instruct-2507",
        messages: [{
          role: "user",
          content: `Translate this Chinese technical blog post to English. Keep code blocks, URLs, and technical terms unchanged. Return ONLY the translated text, nothing else.\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 12000)}`,
        }],
        temperature: 0.3,
        max_completion_tokens: 8192,
      }),
    });
    if (!res.ok) return { title, content };
    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content || "";
    // Extract title from first line if it looks like a title
    const lines = translated.split("\n").filter((l: string) => l.trim());
    const translatedTitle = lines[0]?.replace(/^#+\s*/, "").replace(/^Title:\s*/i, "") || title;
    return { title: translatedTitle, content: translated };
  } catch {
    return { title, content };
  }
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
