"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatBlock =
  | { type: "user"; content: string }
  | { type: "assistant"; content: string }
  | { type: "tool"; name: string; input?: string; done: boolean };

function formatToolInput(name: string, input?: string): string {
  if (!input) return name;
  try {
    const parsed = JSON.parse(input);
    if (name === "Read" && parsed.file_path) return `Read ${parsed.file_path}`;
    if (name === "Glob" && parsed.pattern) return `Glob ${parsed.pattern}`;
    if (name === "Grep" && parsed.pattern) return `Grep "${parsed.pattern}"`;
    return `${name} ${JSON.stringify(parsed)}`;
  } catch {
    return name;
  }
}

interface PortalChatProps {
  agentName: string;
  displayName: string;
}

export function PortalChat({ agentName, displayName }: PortalChatProps) {
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [blocks]);

  function appendToLastAssistant(text: string) {
    setBlocks((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === "assistant") {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, content: last.content + text };
        return updated;
      }
      return [...prev, { type: "assistant", content: text }];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setBlocks((prev) => [...prev, { type: "user", content: userMessage }]);
    setIsStreaming(true);

    try {
      const res = await fetch(`/api/chat/${agentName}`, {
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
            const data = dataLines.join("\n");
            dataLines = [];

            if (currentEvent === "session") {
              setSessionId(data);
            } else if (currentEvent === "delta") {
              appendToLastAssistant(data);
            } else if (currentEvent === "tool_start") {
              const { name } = JSON.parse(data);
              setBlocks((prev) => [...prev, { type: "tool", name, done: false }]);
            } else if (currentEvent === "tool_input") {
              setBlocks((prev) => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].type === "tool") {
                    updated[i] = { ...(updated[i] as ChatBlock & { type: "tool" }), input: data };
                    break;
                  }
                }
                return updated;
              });
            } else if (currentEvent === "tool_result") {
              setBlocks((prev) => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].type === "tool" && !(updated[i] as ChatBlock & { type: "tool" }).done) {
                    updated[i] = { ...(updated[i] as ChatBlock & { type: "tool" }), done: true };
                    break;
                  }
                }
                return updated;
              });
            } else if (currentEvent === "error") {
              appendToLastAssistant(`Error: ${data}`);
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      appendToLastAssistant(`Connection error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsStreaming(false);
    }
  }

  const hasMessages = blocks.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {!hasMessages && (
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
        <div className="space-y-3">
          {blocks.map((block, i) => {
            if (block.type === "user") {
              return (
                <div key={i} className="flex justify-end animate-fade-in-up">
                  <div className="max-w-[80%] rounded-sm px-4 py-3 bg-amber/10 border border-amber/20 text-foreground">
                    <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{block.content}</p>
                  </div>
                </div>
              );
            }

            if (block.type === "tool") {
              const label = formatToolInput(block.name, block.input);
              return (
                <div key={i} className="flex justify-start pl-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/20 border border-border/50 rounded-sm font-mono text-[11px] text-muted-foreground">
                    {!block.done ? (
                      <div className="size-1.5 rounded-full bg-amber animate-[glow-pulse_1s_ease-in-out_infinite]" />
                    ) : (
                      <svg className="size-3 text-amber/60" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8.5l3.5 3.5 6.5-7" />
                      </svg>
                    )}
                    <span className="text-amber/50">{block.name}</span>
                    <span className="text-foreground/70 max-w-md truncate">{label !== block.name ? label : ""}</span>
                  </div>
                </div>
              );
            }

            // assistant
            const isLastBlock = i === blocks.length - 1;
            const isActivelyStreaming = isStreaming && isLastBlock;
            return (
              <div key={i} className="flex justify-start animate-fade-in-up">
                <div className="max-w-[80%] rounded-sm px-4 py-3 bg-card border border-border text-foreground">
                  <span className="font-mono text-[10px] text-amber tracking-wider uppercase block mb-1.5">
                    {displayName}
                  </span>
                  {block.content ? (
                    <div className={`text-sm font-mono leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-foreground prose-headings:font-mono prose-headings:mt-3 prose-headings:mb-1.5 prose-strong:text-amber/90 prose-code:text-amber/80 prose-code:bg-amber/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-border prose-pre:rounded-sm prose-a:text-amber/70 prose-a:no-underline hover:prose-a:text-amber${isActivelyStreaming ? " streaming-cursor" : ""}`}>
                      <Markdown remarkPlugins={[remarkGfm]}>{block.content}</Markdown>
                    </div>
                  ) : isActivelyStreaming ? (
                    <div className="flex items-center gap-1.5 mt-1 py-1">
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border pt-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          {hasMessages && !isStreaming && (
            <button
              type="button"
              onClick={() => {
                setBlocks([]);
                setSessionId(null);
              }}
              className="px-3 py-2.5 bg-card border border-border rounded-sm font-mono text-[10px] text-muted-foreground tracking-wider uppercase hover:border-amber/30 hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
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
