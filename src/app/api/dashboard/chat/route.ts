import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { trackApiUsage } from "@/lib/api-usage";
import { gatherRAGContext } from "@/lib/chat-context";

const ZAI_MODEL = "GLM-4.7-Flash";
const DEEPSEEK_MODEL = "deepseek-chat";

interface Provider {
  name: "zai" | "deepseek" | "cerebras";
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokensKey?: string;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, conversationId } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    conversationId?: string | null;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  // Resolve or create conversation (scoped to user)
  let convId = conversationId || null;
  const lastUserMessage = messages[messages.length - 1]?.content || "";

  if (!convId) {
    const title = lastUserMessage.slice(0, 60) || "New conversation";
    const conv = await prisma.conversation.create({
      data: { title, userId: user.id },
    });
    convId = conv.id;
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { conversationId: convId, role: "user", content: lastUserMessage },
  });

  // Get RAG context from knowledge base
  const ragContext = await gatherRAGContext(lastUserMessage);

  // Fetch active products for context
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { name: true, description: true },
    take: 20,
  });

  const productList = products.map((p) => `- ${p.name}: ${p.description || ""}`).join("\n");

  const systemPrompt = `You are a customer support assistant for Sienovo, a China-based company that exports industrial products (edge AI computing, networking equipment, industrial vision systems) to overseas markets.

Products:
${productList}

${ragContext}

Guidelines:
- Be helpful, professional, and concise
- Answer questions about products, pricing, specifications, shipping, and lead times
- When answering about products, reference the knowledge base content above
- If you don't know specific pricing or availability, suggest the customer create a ticket or book a demo
- For complex technical questions, suggest contacting the sales team
- Demo booking: https://calendly.com/sienovo
- Format responses with markdown for readability`;

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  // Build provider chain: Z.AI (free) → DeepSeek (cheap) → Cerebras (fallback)
  const providers: Provider[] = [];

  if (process.env.ZAI_API_KEY) {
    providers.push({
      name: "zai",
      model: ZAI_MODEL,
      baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
      apiKey: process.env.ZAI_API_KEY,
      maxTokensKey: "max_tokens",
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: "deepseek",
      model: DEEPSEEK_MODEL,
      baseUrl: "https://api.deepseek.com/chat/completions",
      apiKey: process.env.DEEPSEEK_API_KEY,
      maxTokensKey: "max_tokens",
    });
  }

  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      name: "cerebras",
      model: "qwen-3-235b-a22b-instruct-2507",
      baseUrl: "https://api.cerebras.ai/v1/chat/completions",
      apiKey: process.env.CEREBRAS_API_KEY,
      maxTokensKey: "max_completion_tokens",
    });
  }

  if (providers.length === 0) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  // Try each provider in order
  for (const provider of providers) {
    const result = await tryProvider(provider, chatMessages, convId);
    if (result) return result;
  }

  return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
}

// ── Generic OpenAI-compatible provider ───────────────────────────────────────

async function tryProvider(
  provider: Provider,
  chatMessages: { role: string; content: string }[],
  conversationId: string
): Promise<Response | null> {
  try {
    const body: Record<string, unknown> = {
      model: provider.model,
      messages: chatMessages,
      temperature: 0.7,
      stream: true,
    };
    body[provider.maxTokensKey || "max_tokens"] = 4096;

    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      trackApiUsage(provider.name, "customer_chat", false);
      return null; // try next provider
    }

    trackApiUsage(provider.name, "customer_chat");

    const reader = res.body?.getReader();
    if (!reader) return null;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ model: provider.model, conversationId })}\n\n`)
        );
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const data = JSON.parse(jsonStr);
                const text = data.choices?.[0]?.delta?.content;
                if (text) {
                  fullText += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
        } finally {
          if (fullText) {
            await prisma.chatMessage.create({
              data: {
                conversationId,
                role: "assistant",
                content: fullText,
                model: provider.model,
              },
            });
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch {
    trackApiUsage(provider.name, "customer_chat", false);
    return null;
  }
}
