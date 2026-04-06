import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth0";
import { gatherContext, gatherRAGContext } from "@/lib/chat-context";
import { trackApiUsage } from "@/lib/api-usage";
import { prisma } from "@/lib/prisma";
import { executeTool, TOOL_DESCRIPTIONS } from "@/lib/chat-tools";

const GEMINI_MODEL = "gemini-2.5-flash";
const CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507";
const OPENROUTER_MODEL = "qwen/qwen3.6-plus:free";

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

  // All providers failed — return a user-friendly streamed error
  const encoder = new TextEncoder();
  const errorStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: "none", conversationId: convId })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "⚠️ AI 服务暂时繁忙，所有模型（Gemini / Cerebras / OpenRouter）均不可用。请稍等几秒后重试。" })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(errorStream, { headers: SSE_HEADERS });
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

const TOOL_LABELS: Record<string, string> = {
  enrich_contact: "🔍 正在查询联系人信息...",
  enrich_company: "🏢 正在查询公司信息...",
  search_contacts: "📋 正在搜索 CRM 联系人...",
  search_companies: "📋 正在搜索 CRM 公司...",
  search_people_at_company: "👥 正在搜索公司联系人...",
  recommend_prospects: "🤖 正在分析并推荐潜在客户（含 Apollo 联系人查找）...",
  add_contact: "➕ 正在添加联系人...",
  add_company: "➕ 正在添加公司...",
  web_search: "🌐 正在搜索网络...",
  search_social_leads: "📱 正在搜索社交媒体平台...",
};

async function executeToolCalls(
  text: string,
  onStatus?: (msg: string) => void
): Promise<{ cleanText: string; toolResults: string } | null> {
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
      const label = TOOL_LABELS[parsed.name] || `⚙️ 正在执行 ${parsed.name}...`;
      if (onStatus) onStatus(label);
      const result = await executeTool(parsed.name, parsed.args || {});
      results.push(`**[${parsed.name}]** ${result}`);
    } catch (e) {
      results.push(`**[tool error]** ${e instanceof Error ? e.message : "Failed to parse tool call"}`);
    }
    // Remove the matched tool call from text
    normalized = normalized.replace(fullMatch, "");
  }

  // Strip **[tool_name]** prefix — the follow-up AI will format properly
  const cleanResults = results.map((r) => r.replace(/^\*\*\[[^\]]+\]\*\*\s*/, ""));
  return { cleanText: normalized.trim(), toolResults: cleanResults.join("\n\n---\n\n") };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function saveAssistantMessage(conversationId: string, content: string, model: string) {
  await prisma.chatMessage.create({
    data: { conversationId, role: "assistant", content, model },
  });
}

const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" };

// Build the follow-up messages for tool result summarization
function buildFollowUpMessages(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  toolExec: { cleanText: string; toolResults: string }
) {
  const followUpPrompt = `工具执行完毕，结果如下:\n\n${toolExec.toolResults}\n\n请将以上结果整理为清晰的中文总结。要求：\n1. 用 ✅ 标记成功操作，❌ 标记失败操作\n2. 用表格展示多条数据，表格必须包含所有找到的邮箱地址（📧 列）\n3. 不要重复原始工具输出，用自然语言总结\n4. 如果是添加操作，明确说明"已成功添加到 CRM"\n5. 不要使用 <tool> 标签\n6. 邮箱地址是最重要的信息，绝对不能省略`;
  return { followUpPrompt };
}

// Try Gemini follow-up (buffered). Returns full text or null.
async function geminiFollowUp(
  apiKey: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  toolExec: { cleanText: string; toolResults: string }
): Promise<string | null> {
  const { followUpPrompt } = buildFollowUpMessages(systemPrompt, messages, toolExec);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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
            { role: "user", parts: [{ text: followUpPrompt }] },
          ],
          generationConfig: { temperature: 0.5, maxOutputTokens: 16384 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.length >= 50 ? text : null; // too short = truncated
  } catch {
    return null;
  }
}

// Cerebras follow-up (streaming via SSE). Streams directly to controller, returns full text.
async function cerebrasFollowUpStream(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  toolExec: { cleanText: string; toolResults: string },
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<string | null> {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasKey) return null;
  const { followUpPrompt } = buildFollowUpMessages(systemPrompt, messages, toolExec);
  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cerebrasKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
          { role: "assistant", content: toolExec.cleanText },
          { role: "user", content: followUpPrompt },
        ],
        temperature: 0.5,
        max_completion_tokens: 16384,
      }),
    });
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
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
          const t = data.choices?.[0]?.delta?.content;
          if (t) {
            fullText += t;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: t })}\n\n`));
          }
        } catch {}
      }
    }
    return fullText || null;
  } catch {
    return null;
  }
}

// OpenRouter follow-up (non-streaming fallback)
async function openrouterFollowUp(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  toolExec: { cleanText: string; toolResults: string }
): Promise<string | null> {
  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) return null;
  const { followUpPrompt } = buildFollowUpMessages(systemPrompt, messages, toolExec);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${orKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
          { role: "assistant", content: toolExec.cleanText },
          { role: "user", content: followUpPrompt },
        ],
        temperature: 0.5,
        max_tokens: 16384,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

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
    return null; // fallback to next provider
  }

  trackApiUsage("gemini", "chat");

  const reader = res.body?.getReader();
  if (!reader) return NextResponse.json({ error: "No response stream" }, { status: 502 });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Step 1: Buffer the full Gemini response first (don't stream yet)
  // This lets us detect tool calls before sending anything to the client
  let fullText = "";
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
        if (text) fullText += text;
      } catch { /* skip malformed */ }
    }
  }

  // Step 2: Check for tool calls
  const hasToolCalls = TOOL_PATTERNS.some((p) => new RegExp(p.source, p.flags).test(
    fullText.replace(/&lt;tool&gt;/g, "<tool>").replace(/&lt;\/tool&gt;/g, "</tool>")
  ));

  if (!hasToolCalls) {
    // No tools — stream the buffered text as-is
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: GEMINI_MODEL, conversationId })}\n\n`));
        // Stream in chunks for typing effect
        const words = fullText.split(/(?<=\s)/);
        let buffer = "";
        for (const word of words) {
          buffer += word;
          if (buffer.length >= 20) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`));
            buffer = "";
          }
        }
        if (buffer) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buffer })}\n\n`));
        saveAssistantMessage(conversationId, fullText, GEMINI_MODEL);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // Step 3: Has tool calls — execute tools, then stream formatted follow-up
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: GEMINI_MODEL, conversationId })}\n\n`));

      // Execute tools with status messages
      const toolExec = await executeToolCalls(fullText, (status) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `> ${status}\n\n` })}\n\n`));
      });

      if (!toolExec) {
        // Shouldn't happen, but fallback
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: fullText })}\n\n`));
        saveAssistantMessage(conversationId, fullText, GEMINI_MODEL);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      // Follow-up strategy:
      // 1. Try Gemini (buffered) — if complete, stream the buffer
      // 2. If Gemini fails/truncates — stream Cerebras directly (reliable, won't cut off)
      // 3. If Cerebras fails — try OpenRouter (buffered)
      // 4. Last resort — show raw tool results

      let finalText = "";

      // Attempt 1: Gemini buffered
      const geminiText = await geminiFollowUp(apiKey, systemPrompt, messages, toolExec);
      if (geminiText) {
        // Gemini succeeded — stream the buffered content
        finalText = geminiText;
        const words = finalText.split(/(?<=\s)/);
        let buf = "";
        for (const word of words) {
          buf += word;
          if (buf.length >= 30) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buf })}\n\n`));
            buf = "";
          }
        }
        if (buf) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buf })}\n\n`));
      } else {
        // Attempt 2: Cerebras streaming (won't truncate)
        const cerebrasText = await cerebrasFollowUpStream(
          systemPrompt, messages, toolExec, controller, encoder
        );
        if (cerebrasText) {
          finalText = cerebrasText;
        } else {
          // Attempt 3: OpenRouter buffered
          const orText = await openrouterFollowUp(systemPrompt, messages, toolExec);
          if (orText) {
            finalText = orText;
          } else {
            // Last resort: raw tool results
            finalText = toolExec.toolResults;
          }
          // Stream the buffered text
          const words = finalText.split(/(?<=\s)/);
          let buf = "";
          for (const word of words) {
            buf += word;
            if (buf.length >= 30) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buf })}\n\n`));
              buf = "";
            }
          }
          if (buf) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: buf })}\n\n`));
        }
      }

      const savedText = finalText;
      saveAssistantMessage(conversationId, savedText, GEMINI_MODEL);
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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
    return null; // fallback to next provider
  }

  trackApiUsage("cerebras", "chat");
  const resData = await res.json();
  let fullText = resData.choices?.[0]?.message?.content || "";

  // Step 2: Check for tool calls and execute them
  const statusMessages: string[] = [];
  const toolExec = await executeToolCalls(fullText, (status) => {
    statusMessages.push(status);
  });
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
      // Show tool status messages first if any
      if (statusMessages.length > 0) {
        const statusText = statusMessages.map((s) => `> ${s}`).join("\n") + "\n\n";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: statusText })}\n\n`));
      }
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
      const savedText = (statusMessages.length > 0 ? statusMessages.map((s) => `> ${s}`).join("\n") + "\n\n" : "") + fullText;
      saveAssistantMessage(conversationId, savedText, CEREBRAS_MODEL);
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ── OpenRouter (OpenAI-compatible, 3rd fallback) ────────────────────────────

async function tryOpenRouter(
  apiKey: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  conversationId: string
): Promise<Response | null> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system" as const, content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 16384,
    }),
  });

  if (!res.ok) {
    trackApiUsage("gemini", "chat_openrouter", false);
    return null;
  }

  trackApiUsage("gemini", "chat_openrouter");
  const resData = await res.json();
  let fullText = resData.choices?.[0]?.message?.content || "";

  // Check for tool calls
  const orStatusMessages: string[] = [];
  const toolExec = await executeToolCalls(fullText, (status) => {
    orStatusMessages.push(status);
  });
  if (toolExec) {
    try {
      const followRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            { role: "assistant", content: toolExec.cleanText },
            { role: "user", content: `工具执行完毕，结果如下:\n\n${toolExec.toolResults}\n\n请将以上结果整理为清晰的中文总结。用 ✅ 标记成功，❌ 标记失败，用表格展示数据。不要使用 <tool> 标签。` },
          ],
          temperature: 0.5,
          max_tokens: 16384,
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ model: OPENROUTER_MODEL, conversationId })}\n\n`));
      if (orStatusMessages.length > 0) {
        const statusText = orStatusMessages.map((s) => `> ${s}`).join("\n") + "\n\n";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: statusText })}\n\n`));
      }
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
      saveAssistantMessage(conversationId, fullText, OPENROUTER_MODEL);
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
