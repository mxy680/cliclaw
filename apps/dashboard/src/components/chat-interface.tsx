"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface({ agentName, displayName }: { agentName: string; displayName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/agent/${agentName}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, sessionId }),
      });

      if (!res.ok || !res.body) throw new Error("Failed to connect");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        let dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            dataLines = [];
          } else if (line.startsWith("data: ") || line === "data:") {
            dataLines.push(line.startsWith("data: ") ? line.slice(6) : "");
          } else if (line === "" && currentEvent && dataLines.length > 0) {
            // Empty line = end of SSE message
            const data = dataLines.join("\n");
            dataLines = [];
            if (currentEvent === "session") {
              setSessionId(data);
            } else if (currentEvent === "delta") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + data };
                }
                return updated;
              });
            } else if (currentEvent === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: `Error: ${data}` };
                }
                return updated;
              });
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: `Connection error: ${err instanceof Error ? err.message : "Unknown error"}`,
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-mono text-sm text-muted-foreground">
                Start a conversation with {displayName}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/50 mt-2 tracking-wider uppercase">
                Powered by Claude Code
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-sm px-4 py-3 ${
                msg.role === "user"
                  ? "bg-amber/10 border border-amber/20 text-foreground"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="font-mono text-[10px] text-amber tracking-wider uppercase block mb-1.5">
                  {displayName}
                </span>
              )}
              <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{msg.content}</p>
              {msg.role === "assistant" && isStreaming && i === messages.length - 1 && !msg.content && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="size-1.5 rounded-full bg-amber animate-[glow-pulse_1s_ease-in-out_infinite]" />
                  <span className="font-mono text-[10px] text-muted-foreground">thinking...</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border pt-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isStreaming}
            className="flex-1 bg-card border border-border rounded-sm px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/20 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-5 py-2.5 bg-amber/10 border border-amber/30 rounded-sm font-mono text-xs text-amber tracking-wider uppercase hover:bg-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
