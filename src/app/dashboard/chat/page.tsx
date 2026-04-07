"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";

interface Message { role: "user" | "assistant"; content: string; }
interface ConversationItem { id: string; title: string; updatedAt: string; }

export default function CustomerChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { dict } = useI18n();
  const t = dict.dashboard?.chat || {};

  const suggestions = t.suggestions || [
    "What products do you offer?",
    "Tell me about your edge AI solutions",
    "What are the shipping options?",
    "How can I get a quote?",
    "What is the typical lead time?",
    "Do you offer technical support?",
  ];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { fetchConversations(); }, []);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/dashboard/conversations");
      if (res.ok) setConversations(await res.json());
    } catch {}
  }

  async function loadConversation(id: string) {
    const res = await fetch(`/api/dashboard/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setActiveConvId(id);
    setMessages(data.messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })));
  }

  function newChat() { setActiveConvId(null); setMessages([]); }

  async function deleteConversation(id: string) {
    await fetch(`/api/dashboard/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) newChat();
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setStreaming(true);
    setMessages([...newMsgs, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, conversationId: activeConvId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages([...newMsgs, { role: "assistant", content: `Error: ${err.error}` }]);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const d = line.slice(6);
          if (d === "[DONE]") continue;
          try {
            const p = JSON.parse(d);
            if (p.conversationId && !activeConvId) setActiveConvId(p.conversationId);
            if (p.text) { fullText += p.text; setMessages([...newMsgs, { role: "assistant", content: fullText }]); }
          } catch {}
        }
      }
      fetchConversations();
    } catch {
      setMessages([...newMsgs, { role: "assistant", content: t.failedConnect || "Failed to connect. Please try again." }]);
    }
    setStreaming(false);
  }, [messages, streaming, activeConvId, t.failedConnect]);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-60" : "w-0"} shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col transition-all overflow-hidden`}>
        <div className="p-3 border-b border-gray-200">
          <button onClick={newChat} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t.newChat || "New Chat"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <div key={c.id} onClick={() => loadConversation(c.id)}
              className={`group flex items-center gap-1 px-3 py-2.5 cursor-pointer border-b border-gray-100 ${activeConvId === c.id ? "bg-white border-l-2 border-l-blue-500" : "hover:bg-white"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{c.title}</p>
                <p className="text-xs text-gray-400">{new Date(c.updatedAt).toLocaleDateString()}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t.title || "AI Assistant"}</h2>
            <p className="text-xs text-gray-500">{t.subtitle || "Ask about products, pricing, and shipping"}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto pt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">{t.greeting || "How can I help?"}</h3>
              <p className="text-sm text-gray-500 mb-6 text-center">{t.greetingSub || "Ask about our products, pricing, shipping, or technical specs."}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {suggestions.map((s: string) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`max-w-3xl ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
              <div className={`rounded-2xl px-5 py-3 ${msg.role === "user" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content || (t.thinking || "Thinking...")}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 bg-white px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-3">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder={t.placeholder || "Ask a question..."} rows={1} disabled={streaming}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" />
            <button onClick={() => sendMessage(input)} disabled={streaming || !input.trim()}
              className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:bg-gray-300 shrink-0">
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
