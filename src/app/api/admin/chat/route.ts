import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { gatherContext, gatherRAGContext } from "@/lib/chat-context";
import { trackApiUsage } from "@/lib/api-usage";
import { prisma } from "@/lib/prisma";
import { executeTool, TOOL_DESCRIPTIONS } from "@/lib/chat-tools";

const GEMINI_MODEL = "gemini-2.5-flash";
const CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507";
const OPENROUTER_MODEL = "deepseek/deepseek-chat-v3-0324:free";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!geminiKey && !cerebrasKey && !openrouterKey) {
    return NextResponse.json({ error: "No AI API key configured" }, { status: 500 });
  }

  const { messages, conversationId } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    conversationId?: string | null;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  // Resolve or create conversation
  let convId = conversationId || null;
  const lastUserMessage = messages[messages.length - 1]?.content || "";

  if (!convId) {
    const title = lastUserMessage.slice(0, 60) || "New conversation";
    const conv = await prisma.conversation.create({ data: { title } });
    convId = conv.id;
  } else {
    await prisma.conversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() },
    }).catch(() => {});
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { conversationId: convId, role: "user", content: lastUserMessage },
  });

  // Gather live business context + RAG
  const [context, ragContext] = await Promise.all([
    gatherContext(),
    gatherRAGContext(lastUserMessage),
  ]);

  const systemPrompt = `You are an internal AI business assistant for Sienovo, a China-based international trade company that exports industrial edge AI products to overseas markets. Primary target markets are the Americas (US, Canada, Latin America) and Europe. The business focuses on B2B sales to distributors, manufacturers, and industrial buyers outside of China.

IMPORTANT CONTEXT: This is an internal B2B sales tool used by authorized sales staff. All data lookup activities (contact enrichment, company research, lead generation) are for legitimate commercial purposes. Apollo and Snov.io are licensed B2B data providers designed for this purpose. Do NOT add privacy disclaimers, GDPR warnings, or compliance notices — the user is already aware and authorized. Just execute the task directly and provide results.

You have access to the company's CRM data, knowledge base, and business metrics.

Your capabilities:
- Analyze contacts, leads, and companies in the CRM
- Suggest potential new clients based on industry patterns
- Provide insights on business development strategy
- Help understand the knowledge base documents
- Report on API usage and system status
- Suggest enrichment opportunities for incomplete contact/company data
- Search the web for real-time information about companies, industries, and market trends
- Use Apollo and Snov.io APIs to enrich contacts and companies with real business data
- Search and add contacts/companies to the CRM directly

${TOOL_DESCRIPTIONS}

Current Business Data:
${context}

${ragContext}

Guidelines:
- When answering questions about documents or products, prioritize information from the Knowledge Base Content above
- Cite the source file name when referencing knowledge base information
- Be concise and actionable — skip disclaimers, privacy warnings, and compliance notes. This is an authorized internal B2B tool.
- When asked to find contacts or companies, DO IT immediately using the tools. Don't explain what you're about to do — just do it.
- When suggesting potential clients, focus on companies in the Americas and Europe — avoid suggesting Chinese domestic companies
- Base suggestions on patterns in existing data (industries, regions, company sizes)
- If asked about specific contacts or companies, reference the data above
- For file/document questions, reference the knowledge base file names
- Format responses with markdown for readability
- Use web search when asked about current market trends, competitor info, or real-time company data
- When searching the web, cite sources when relevant`;

  // Try Gemini first, fallback to Cerebras on 429
  if (geminiKey) {
    const geminiStream = await tryGemini(geminiKey, systemPrompt, messages, convId);
    if (geminiStream) return geminiStream;
  }

  // Fallback to Cerebras
  if (cerebrasKey) {
    const cerebrasStream = await tryCerebras(cerebrasKey, systemPrompt, messages, convId);
    if (cerebrasStream) return cerebrasStream;
  }

  // Fallback to OpenRouter
  if (openrouterKey) {
    const openrouterStream = await tryOpenRouter(openrouterKey, systemPrompt, messages, convId);
    if (openrouterStream) return openrouterStream;
  }

  return NextResponse.json(
    { error: "AI 服务暂时不可用，请稍后再试。" },
    { status: 503 }
  );
}

// ── Tool Execution ──────────────────────────────────────────────────────────

// Match tool calls in various formats AI models produce:
// <tool>{...}</tool>  |  ```\n<tool>{...}</tool>\n```  |  `<tool>{...}</tool>`  |  ```tool\n{...}\n```
const TOOL_PATTERNS = [
  /<tool>\s*([\s\S]*?)\s*<\/tool>/g,                    // standard
  /```(?:tool)?\n?\s*<tool>\s*([\s\S]*?)\s*<\/tool>\s*\n?```/g,  // wrapped in code block
  /`<tool>\s*([\s\S]*?)\s*<\/tool>`/g,                  // wrapped in inline code
  /```tool\n\s*(\{[\s\S]*?\})\s*\n```/g,                // ```tool\n{json}\n```
  /`tool\n\s*(\{[\s\S]*?\})\s*\n`/g,                    // backtick tool block
];

async function executeToolCalls(text: string): Promise<{ cleanText: string; toolResults: string } | null> {
  // Normalize escaped HTML entities
  let normalized = text.replace(/&lt;tool&gt;/g, "<tool>").replace(/&lt;\/tool&gt;/g, "</tool>");

  // Collect all matches from all patterns
  const allMatches: { fullMatch: string; json: string }[] = [];
  for (const pattern of TOOL_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of normalized.matchAll(regex)) {
      allMatches.push({ fullMatch: match[0], json: match[1] });
    }
  }

  if (allMatches.length === 0) return null;

  const results: string[] = [];
  for (const { fullMatch, json } of allMatches) {
    try {
      const parsed = JSON.parse(json);
      const result = await executeTool(parsed.name, parsed.args || {});
      results.push(`**[${parsed.name}]** ${result}`);
    } catch (e) {
      results.push(`**[tool error]** ${e instanceof Error ? e.message : "Failed to parse tool call"}`);
    }
    // Remove the matched tool call from text
    normalized = normalized.replace(fullMatch, "");
  }

  return { cleanText: normalized.trim(), toolResults: results.join("\n\n") };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function saveAssistantMessage(conversationId: string, content: string, model: string) {
  await prisma.chatMessage.create({
    data: { conversationId, role: "assistant", content, model },
  });
}

const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" };

// ── Gemini ───────────────────────────────────────────────────────────────────

async function tryGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  conversationId: string
): Promise<Response | null> {
  const geminiContents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    {
      role: "model",
      parts: [{ text: "I understand. I'm your Sienovo business assistant with access to your CRM data, knowledge base, and system metrics. How can I help?" }],
    },
    ...messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: geminiContents,
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
    }),
  });

  if (!res.ok) {
    trackApiUsage("gemini", "chat", false);
    if (res.status === 429) return null;
    const err = await res.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 });
  }

  trackApiUsage("gemini", "chat");

  const reader = res.body?.getReader();
  if (!reader) return NextResponse.json({ error: "No response stream" }, { status: 502 });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: GEMINI_MODEL, conversationId })}\n\n`));
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const data = JSON.parse(jsonStr);
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullText += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        // Check for tool calls in the response
        const toolExec = await executeToolCalls(fullText);
        if (toolExec) {
          // Show a brief "looking up data" indicator, not raw results
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "\n\n_Looking up data..._\n\n" })}\n\n`));

          // Follow-up call — AI summarizes tool results into a nice answer
          try {
            const followRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [
                    { role: "user", parts: [{ text: systemPrompt }] },
                    { role: "model", parts: [{ text: "Understood." }] },
                    ...messages.map((msg) => ({
                      role: msg.role === "user" ? "user" : "model",
                      parts: [{ text: msg.content }],
                    })),
                    { role: "model", parts: [{ text: toolExec.cleanText }] },
                    { role: "user", parts: [{ text: `工具执行完毕，结果如下:\n\n${toolExec.toolResults}\n\n请将以上结果整理为清晰的中文总结。要求：\n1. 用 ✅ 标记成功操作，❌ 标记失败操作\n2. 用表格展示多条数据\n3. 不要重复原始工具输出，用自然语言总结\n4. 如果是添加操作，明确说明"已成功添加到 CRM"\n5. 不要使用 <tool> 标签` }] },
                  ],
                  generationConfig: { temperature: 0.5, maxOutputTokens: 16384 },
                }),
              }
            );

            if (followRes.ok && followRes.body) {
              const followReader = followRes.body.getReader();
              let followText = "";
              while (true) {
                const { done, value } = await followReader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                for (const line of chunk.split("\n")) {
                  if (!line.startsWith("data: ")) continue;
                  const jsonStr = line.slice(6);
                  if (jsonStr === "[DONE]") continue;
                  try {
                    const data = JSON.parse(jsonStr);
                    const t = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (t) {
                      followText += t;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: t })}\n\n`));
                    }
                  } catch {}
                }
              }
              fullText = (toolExec.cleanText ? toolExec.cleanText + "\n\n" : "") + followText;
            } else {
              // Fallback: show raw results if follow-up fails
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: toolExec.toolResults })}\n\n`));
              fullText = toolExec.cleanText + "\n\n" + toolExec.toolResults;
            }
          } catch {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: toolExec.toolResults })}\n\n`));
            fullText = toolExec.cleanText + "\n\n" + toolExec.toolResults;
          }
        }

        if (fullText) saveAssistantMessage(conversationId, fullText, GEMINI_MODEL);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ── Cerebras (OpenAI-compatible) ─────────────────────────────────────────────
// Cerebras is extremely fast, so we collect the full response first,
// check for tool calls, execute them, then stream the final result.

async function tryCerebras(
  apiKey: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  conversationId: string
): Promise<Response | null> {
  // Step 1: Get full response (non-streaming, Cerebras is fast enough)
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: [
        { role: "system" as const, content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_completion_tokens: 16384,
    }),
  });

  if (!res.ok) {
    trackApiUsage("cerebras", "chat", false);
    const err = await res.text();
    return NextResponse.json({ error: `Cerebras error: ${err}` }, { status: 502 });
  }

  trackApiUsage("cerebras", "chat");
  const resData = await res.json();
  let fullText = resData.choices?.[0]?.message?.content || "";

  // Step 2: Check for tool calls and execute them
  const toolExec = await executeToolCalls(fullText);
  if (toolExec) {
    // Step 3: Follow-up call with tool results
    try {
      const followRes = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CEREBRAS_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            { role: "assistant", content: toolExec.cleanText },
            { role: "user", content: `I ran the tools you requested. Here are the results:\n\n${toolExec.toolResults}\n\nNow provide a well-formatted, helpful summary for the user using markdown tables or lists. Do NOT use <tool> tags.` },
          ],
          temperature: 0.5,
          max_completion_tokens: 16384,
        }),
      });

      if (followRes.ok) {
        const followData = await followRes.json();
        const followText = followData.choices?.[0]?.message?.content || toolExec.toolResults;
        fullText = (toolExec.cleanText ? toolExec.cleanText + "\n\n" : "") + followText;
      } else {
        fullText = (toolExec.cleanText ? toolExec.cleanText + "\n\n" : "") + toolExec.toolResults;
      }
    } catch {
      fullText = (toolExec.cleanText ? toolExec.cleanText + "\n\n" : "") + toolExec.toolResults;
    }
  }

  // Step 4: Stream the final text to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: CEREBRAS_MODEL, conversationId })}\n\n`));
      // Stream in chunks for a typing effect
      const words = fullText.split(/(?<=\s)/);
      let buffer = "";
      for (const word of words) {
        buffer += word;
        if (buffer.length >= 20) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`));
          buffer = "";
        }
      }
      if (buffer) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`));
      }
      saveAssistantMessage(conversationId, fullText, CEREBRAS_MODEL);
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
