"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

// Don't show the public widget on internal/auth surfaces.
const HIDDEN_PREFIXES = ["/admin", "/dashboard", "/login", "/auth"];

export default function SupportChat() {
  const pathname = usePathname();
  const locale: "en" | "zh" = pathname?.startsWith("/zh") ? "zh" : "en";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const t =
    locale === "zh"
      ? {
          title: "Sienovo 助手",
          greeting: "您好!我是 Sienovo 的产品助手,可以帮您了解 INT-AIBOX 边缘 AI、工业网关与视觉产品。请问有什么可以帮您?",
          placeholder: "输入您的问题…",
          send: "发送",
          aria: "打开客服对话",
        }
      : {
          title: "Sienovo Assistant",
          greeting: "Hi! I'm Sienovo's product assistant. Ask me about INT-AIBOX edge AI, industrial gateways, or vision products — how can I help?",
          placeholder: "Type your question…",
          send: "Send",
          aria: "Open support chat",
        };

  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: t.greeting }]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Drop the canned greeting from what we send to the model.
        body: JSON.stringify({ messages: next.filter((m, i) => !(i === 0 && m.role === "assistant")) }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") continue;
          try {
            const d = JSON.parse(j);
            if (d.text) {
              acc += d.text;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content:
            locale === "zh"
              ? "抱歉,出了点问题。您可以直接联系我们:collin.liu@sienovo.cn"
              : "Sorry, something went wrong. Please reach us at collin.liu@sienovo.cn",
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t.aria}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:bottom-5 sm:right-5 sm:inset-auto">
          <div className="flex h-[100dvh] w-full flex-col bg-white shadow-2xl sm:h-[560px] sm:w-[380px] sm:rounded-2xl sm:border sm:border-gray-200">
            <div className="flex items-center justify-between rounded-t-2xl bg-accent px-4 py-3 text-white">
              <span className="font-semibold">{t.title}</span>
              <button onClick={() => setOpen(false)} aria-label="close" className="text-white/80 hover:text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-accent text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {m.content || "…"}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-gray-100 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.placeholder}
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t.send}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
