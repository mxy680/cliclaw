"use client";

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  fileNames?: string[];
}

export function ChatInterface({ agentName, displayName }: { agentName: string; displayName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isStreaming) return;

    const userMessage = input.trim();
    const currentFiles = [...files];
    const fileNames = currentFiles.map((f) => f.name);

    setInput("");
    setFiles([]);
    setMessages((prev) => [...prev, { role: "user", content: userMessage, fileNames: fileNames.length > 0 ? fileNames : undefined }]);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      let res: Response;

      if (currentFiles.length > 0) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append("message", userMessage);
        if (sessionId) formData.append("sessionId", sessionId);
        for (const file of currentFiles) {
          formData.append("files", file);
        }
        res = await fetch(`/api/agent/${agentName}/chat`, {
          method: "POST",
          body: formData,
        });
      } else {
        // JSON for text-only messages
        res = await fetch(`/api/agent/${agentName}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, sessionId }),
        });
      }

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
              {msg.role === "user" && msg.fileNames && msg.fileNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.fileNames.map((name, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber/5 border border-amber/15 rounded-sm font-mono text-[10px] text-amber/70"
                    >
                      <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
                        <path d="M9 1v4h4" />
                      </svg>
                      {name}
                    </span>
                  ))}
                </div>
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

      {/* Attachments preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pb-2">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber/5 border border-amber/20 rounded-sm font-mono text-[11px] text-amber/80"
            >
              <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
                <path d="M9 1v4h4" />
              </svg>
              {f.name}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border pt-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          {messages.length > 0 && !isStreaming && (
            <button
              type="button"
              onClick={() => { setMessages([]); setSessionId(null); }}
              className="px-3 py-2.5 bg-card border border-border rounded-sm font-mono text-[10px] text-muted-foreground tracking-wider uppercase hover:border-amber/30 hover:text-foreground transition-colors"
              title="Clear chat"
            >
              Clear
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="px-3 py-2.5 bg-card border border-border rounded-sm font-mono text-[10px] text-muted-foreground tracking-wider uppercase hover:border-amber/30 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Attach files"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 10.667v2.666A1.333 1.333 0 0112.667 14.667H3.333A1.333 1.333 0 012 13.333v-2.666M11.333 5.333L8 2M8 2L4.667 5.333M8 2v8.667" />
            </svg>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={files.length > 0 ? `${files.length} file(s) attached — add a message...` : "Type a message..."}
            disabled={isStreaming}
            className="flex-1 bg-card border border-border rounded-sm px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/20 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isStreaming || (!input.trim() && files.length === 0)}
            className="px-5 py-2.5 bg-amber/10 border border-amber/30 rounded-sm font-mono text-xs text-amber tracking-wider uppercase hover:bg-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
