"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";

interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { dict } = useI18n();
  const t = dict.admin?.chat || {};

  const SUGGESTIONS = t.suggestions || [
    "What's the current state of our CRM?",
    "Which industries have the most leads?",
    "Suggest potential new clients based on our data",
    "What contacts need enrichment?",
    "Summarize our knowledge base",
    "Find potential distributors in the US and Europe for our products",
    "Show API usage this month",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Load conversation list on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/admin/conversations");
      if (res.ok) setConversations(await res.json());
    } catch { /* ignore */ }
  }

  async function loadConversation(id: string) {
    try {
      const res = await fetch(`/api/admin/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveConvId(id);
      setMessages(
        data.messages.map((m: { role: string; content: string; model?: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          model: m.model || undefined,
        }))
      );
    } catch { /* ignore */ }
  }

  function newChat() {
    setActiveConvId(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/admin/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) newChat();
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;

      const userMessage: Message = { role: "user", content: text.trim() };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setStreaming(true);

      const assistantMessage: Message = { role: "assistant", content: "" };
      setMessages([...newMessages, assistantMessage]);

      try {
        const res = await fetch("/api/admin/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            conversationId: activeConvId,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setMessages([
            ...newMessages,
            { role: "assistant", content: `Error: ${err.error || (t.somethingWrong || "Something went wrong.")}` },
          ]);
          setStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error(t.noStream || "No stream");

        const decoder = new TextDecoder();
        let fullText = "";
        let model = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.model) model = parsed.model;
              if (parsed.conversationId && !activeConvId) {
                setActiveConvId(parsed.conversationId);
              }
              if (parsed.text) {
                fullText += parsed.text;
                setMessages([
                  ...newMessages,
                  { role: "assistant", content: fullText, model },
                ]);
              }
            } catch {
              // Skip
            }
          }
        }

        // Refresh conversation list
        fetchConversations();
      } catch {
        setMessages([
          ...newMessages,
          { role: "assistant", content: t.failedConnect || "Failed to connect. Please try again." },
        ]);
      }

      setStreaming(false);
    },
    [messages, streaming, activeConvId]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col transition-all overflow-hidden`}
      >
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-1 px-3 py-2.5 cursor-pointer border-b border-gray-100 ${
                activeConvId === conv.id
                  ? "bg-white border-l-2 border-l-blue-500"
                  : "hover:bg-white"
              }`}
              onClick={() => loadConversation(conv.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{conv.title}</p>
                <p className="text-xs text-gray-400">
                  {timeAgo(conv.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                title="Delete conversation"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-6">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              {t.title || "AI Assistant"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.subtitle || "Ask about your CRM, contacts, companies, knowledge base, or business strategy"}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto pt-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                {t.greeting || "How can I help?"}
              </h3>
              <p className="text-sm text-gray-500 mb-8 text-center">
                {t.greetingSub || "I have access to your CRM data, knowledge base, and system metrics."}
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s: string) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-3xl ${
                msg.role === "user" ? "ml-auto" : "mr-auto"
              }`}
            >
              <div
                className={`rounded-2xl px-5 py-3 ${
                  msg.role === "user"
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div
                    className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900"
                    dangerouslySetInnerHTML={{
                      __html: simpleMarkdown(stripToolTags(msg.content || (t.thinking || "Thinking..."))),
                    }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "assistant" && msg.content && (
                <div className="flex items-center gap-2 mt-1 ml-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      setCopiedIdx(i);
                      setTimeout(() => setCopiedIdx(null), 2000);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={t.copyResponse || "Copy response"}
                  >
                    {copiedIdx === i ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    )}
                  </button>
                  {msg.model && (
                    <span className="text-xs text-gray-400">{msg.model}</span>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.placeholder || "Ask about your business..."}
              rows={1}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              disabled={streaming}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={streaming || !input.trim()}
              className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300 transition-colors shrink-0"
            >
              {streaming ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Relative time display
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h}h ago`;
  }
  if (diff < 604800) {
    const d = Math.floor(diff / 86400);
    return `${d}d ago`;
  }
  return new Date(dateStr).toLocaleDateString();
}

// Strip <tool> tags from display (they're processed server-side)
function stripToolTags(text: string): string {
  return text
    .replace(/```(?:tool)?\n?\s*<tool>[\s\S]*?<\/tool>\s*\n?```/g, "")
    .replace(/`<tool>[\s\S]*?<\/tool>`/g, "")
    .replace(/<tool>[\s\S]*?<\/tool>/g, "")
    .replace(/```tool\n\s*\{[\s\S]*?\}\s*\n```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Simple markdown → HTML (no external deps)
function simpleMarkdown(text: string): string {
  const escaped = text
    .replace(/\r\n?/g, "\n")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const result: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableHeaderDone = false;
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    // Fenced code blocks: ```lang ... ```
    const codeOpen = line.match(/^```(\w*)$/);
    if (codeOpen && !inCodeBlock) {
      closeLists();
      inCodeBlock = true;
      codeLang = codeOpen[1];
      codeLines = [];
      continue;
    }
    if (inCodeBlock) {
      if (line === "```") {
        const langAttr = codeLang ? ` data-lang="${codeLang}"` : "";
        result.push(`<div class="relative my-3">${codeLang ? `<span class="absolute top-2 right-3 text-xs text-gray-400 select-none">${codeLang}</span>` : ""}<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed"${langAttr}><code>${codeLines.join("\n")}</code></pre></div>`);
        inCodeBlock = false;
        codeLang = "";
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    // Blockquote: > text
    const bq = line.match(/^&gt;\s?(.*)$/);
    if (bq) {
      closeLists();
      result.push(`<blockquote class="border-l-4 border-gray-300 pl-4 my-3 text-gray-500 italic">${inline(bq[1])}</blockquote>`);
      continue;
    }

    // Table: detect lines with | separators
    const isTableRow = line.match(/^\|(.+)\|$/);
    const isSeparator = line.match(/^\|[\s:|-]+\|$/);

    if (isTableRow) {
      if (!inTable) {
        closeLists();
        result.push('<div class="overflow-x-auto my-3"><table class="w-full text-sm border-collapse">');
        inTable = true;
        tableHeaderDone = false;
      }

      if (isSeparator) {
        // This is the header/body separator row — skip it but mark header done
        tableHeaderDone = true;
        continue;
      }

      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      if (!tableHeaderDone) {
        // Header row
        result.push("<thead><tr>");
        for (const cell of cells) {
          result.push(`<th class="border border-gray-200 px-3 py-2 bg-gray-50 font-medium text-gray-700 text-left">${inline(cell)}</th>`);
        }
        result.push("</tr></thead><tbody>");
      } else {
        // Body row
        result.push("<tr>");
        for (const cell of cells) {
          result.push(`<td class="border border-gray-200 px-3 py-2 text-gray-600">${inline(cell)}</td>`);
        }
        result.push("</tr>");
      }
      continue;
    }

    // Close table if we were in one and this line isn't a table row
    if (inTable) {
      result.push("</tbody></table></div>");
      inTable = false;
      tableHeaderDone = false;
    }

    // Headers (h1–h6)
    const hMatch = line.match(/^(#{1,6}) (.+)/);
    if (hMatch) {
      closeLists();
      const level = hMatch[1].length;
      result.push(`<h${level}>${inline(hMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ul = line.match(/^\s*[-*] (.+)/);
    if (ul && !line.match(/^\s*\*\*[^*]/)) {
      if (inOl) { result.push("</ol>"); inOl = false; }
      if (!inUl) { result.push("<ul>"); inUl = true; }
      result.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // Ordered list
    const ol = line.match(/^\s*(\d+)\. (.+)/);
    if (ol) {
      if (inUl) { result.push("</ul>"); inUl = false; }
      const num = parseInt(ol[1], 10);
      if (!inOl) {
        result.push(`<ol start="${num}">`);
        inOl = true;
      }
      result.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      if (inUl || inOl) {
        const next = lines.slice(i + 1).find((l) => l.trim() !== "");
        if (next) {
          if (inUl && next.match(/^\s*[-*] /)) continue;
          if (inOl && next.match(/^\s*\d+\. /)) continue;
        }
      }
      closeLists();
      result.push("");
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      closeLists();
      result.push('<hr class="my-4 border-gray-200">');
      continue;
    }

    closeLists();
    result.push(`<p>${inline(line)}</p>`);
  }

  closeLists();
  if (inTable) {
    result.push("</tbody></table></div>");
  }
  return result.filter(Boolean).join("\n");

  function closeLists() {
    if (inUl) { result.push("</ul>"); inUl = false; }
    if (inOl) { result.push("</ol>"); inOl = false; }
  }

  function inline(s: string): string {
    return s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">$1</a>');
  }
}
