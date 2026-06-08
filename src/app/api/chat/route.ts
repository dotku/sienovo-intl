import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackApiUsage } from "@/lib/api-usage";
import { gatherRAGContext } from "@/lib/chat-context";
import { bedrockChatStream, bedrockConfigured, BEDROCK_CHAT_MODEL_ID } from "@/lib/bedrock";

// Public, no-auth customer support chat for the marketing site. Grounded in the
// product list + RAG knowledge base, scoped strictly to Sienovo topics, and
// instructed to hand off to a human when it doesn't know.

export const maxDuration = 60;

const MAX_MESSAGES = 12;
const MAX_CHARS = 4000;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  let body: { messages?: Msg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Sanitize input: keep the recent turns, cap length, drop empties.
  const messages: Msg[] = (body.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (!messages.length) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const ragContext = await gatherRAGContext(lastUserMessage);

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { name: true, description: true },
    take: 20,
  });
  const productList = products.map((p) => `- ${p.name}: ${p.description || ""}`).join("\n");

  const systemPrompt = `You are the customer support assistant on Sienovo's website (深圳信迈), a China-based manufacturer that exports industrial products — edge AI computing (INT-AIBOX), networking / communication equipment, and industrial vision systems — to overseas markets. You are talking to a website visitor / potential customer.

Products:
${productList}

${ragContext}

## Scope — stay strictly on Sienovo topics
- ONLY help with Sienovo's business, products, services, specifications, applications, pricing, shipping, and support.
- If a question is NOT about Sienovo (general knowledge, other companies or brands, coding, math, personal advice, news, politics, etc.), politely decline in one short sentence and steer back to how you can help with Sienovo products. Do not answer off-topic questions, even if you know the answer.

## Grounding — never invent
- Base product and specification answers ONLY on the Products list and the knowledge base above. Mention the product/source name when you use it.
- Never make up model numbers, specifications, prices, availability, or lead times.

## Hand off to a human when unsure
If you don't know, the knowledge base doesn't cover it, or the request needs a person (custom quotes, pricing/availability, orders, complaints, complex technical design, partnerships), DO NOT guess. Tell the customer our team will help and share these contacts:
- Email: collin.liu@sienovo.cn
- WhatsApp: +86 187 1869 9276
- Contact form: /contact (中文: /zh/contact)
- Book a demo: https://calendly.com/sienovo

## Style
- Reply in the visitor's own language (中文 or English).
- Be warm, professional, and concise. Use markdown.`;

  if (bedrockConfigured()) {
    const res = await tryBedrockStream(systemPrompt, messages);
    if (res) return res;
  }

  const provider = openAiCompatProvider();
  if (provider) {
    const res = await tryProvider(provider, [{ role: "system", content: systemPrompt }, ...messages]);
    if (res) return res;
  }

  return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
}

function sseStream(start: (controller: ReadableStreamDefaultController, enc: TextEncoder) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start: (controller) => start(controller, encoder),
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

async function tryBedrockStream(system: string, messages: Msg[]): Promise<Response | null> {
  let deltas: AsyncIterable<string>;
  try {
    deltas = await bedrockChatStream(messages, { system, maxTokens: 2048 });
  } catch {
    trackApiUsage("bedrock", "public_chat", false);
    return null;
  }
  trackApiUsage("bedrock", "public_chat");
  return sseStream(async (controller, enc) => {
    controller.enqueue(enc.encode(`data: ${JSON.stringify({ model: BEDROCK_CHAT_MODEL_ID })}\n\n`));
    try {
      for await (const delta of deltas) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
      }
    } finally {
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
}

function openAiCompatProvider() {
  if (process.env.CEREBRAS_API_KEY) {
    return {
      name: "cerebras" as const,
      model: "qwen-3-235b-a22b-instruct-2507",
      baseUrl: "https://api.cerebras.ai/v1/chat/completions",
      apiKey: process.env.CEREBRAS_API_KEY,
      maxTokensKey: "max_completion_tokens",
    };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      name: "deepseek" as const,
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/chat/completions",
      apiKey: process.env.DEEPSEEK_API_KEY,
      maxTokensKey: "max_tokens",
    };
  }
  return null;
}

async function tryProvider(
  provider: { name: "cerebras" | "deepseek"; model: string; baseUrl: string; apiKey: string; maxTokensKey: string },
  chatMessages: { role: string; content: string }[],
): Promise<Response | null> {
  try {
    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        messages: chatMessages,
        temperature: 0.6,
        stream: true,
        [provider.maxTokensKey]: 2048,
      }),
    });
    if (!res.ok || !res.body) {
      trackApiUsage(provider.name, "public_chat", false);
      return null;
    }
    trackApiUsage(provider.name, "public_chat");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    return sseStream(async (controller, enc) => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value, { stream: true }).split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") continue;
            try {
              const text = JSON.parse(j).choices?.[0]?.delta?.content;
              if (text) controller.enqueue(enc.encode(`data: ${JSON.stringify({ text })}\n\n`));
            } catch {
              /* skip */
            }
          }
        }
      } finally {
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });
  } catch {
    trackApiUsage(provider.name, "public_chat", false);
    return null;
  }
}
