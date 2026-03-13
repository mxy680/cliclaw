"use client";

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatBlock =
  | { type: "user"; content: string; fileNames?: string[] }
  | { type: "assistant"; content: string }
  | { type: "tool"; name: string; input?: string; done: boolean };

function formatToolInput(name: string, input?: string): string {
  if (!input) return name;
  try {
    const parsed = JSON.parse(input);
    if (name === "Bash" && parsed.command) return parsed.command;
    if (name === "Read" && parsed.file_path) return `Read ${parsed.file_path}`;
    if (name === "Write" && parsed.file_path) return `Write ${parsed.file_path}`;
    if (name === "Edit" && parsed.file_path) return `Edit ${parsed.file_path}`;
    if (name === "Glob" && parsed.pattern) return `Glob ${parsed.pattern}`;
    if (name === "Grep" && parsed.pattern) return `Grep "${parsed.pattern}"`;
    return `${name} ${JSON.stringify(parsed)}`;
  } catch {
    return name;
  }
}

const STORAGE_KEY_PREFIX = "cliclaw-chat-";

function loadChat(agentName: string): { blocks: ChatBlock[]; sessionId: string | null } {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${agentName}`);
    if (!raw) return { blocks: [], sessionId: null };
    const parsed = JSON.parse(raw);
    return { blocks: parsed.blocks ?? [], sessionId: parsed.sessionId ?? null };
  } catch {
    return { blocks: [], sessionId: null };
  }
}

function saveChat(agentName: string, blocks: ChatBlock[], sessionId: string | null) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${agentName}`, JSON.stringify({ blocks, sessionId }));
  } catch {
    // storage full or unavailable — ignore
  }
}

function clearChat(agentName: string) {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${agentName}`);
}

const MODELS: { id: string; label: string }[] = [
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

const MODEL_STORAGE_KEY = "cliclaw-model";

export function ChatInterface({ agentName, displayName }: { agentName: string; displayName: string }) {
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted chat and model preference on mount
  useEffect(() => {
    const saved = loadChat(agentName);
    setBlocks(saved.blocks);
    setSessionId(saved.sessionId);
    const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
    if (savedModel && MODELS.some((m) => m.id === savedModel)) {
      setModel(savedModel);
    }
    setHydrated(true);
  }, [agentName]);

  // Persist chat whenever blocks or sessionId change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveChat(agentName, blocks, sessionId);
  }, [blocks, sessionId, agentName, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [blocks]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function appendToLastAssistant(text: string) {
    setBlocks((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === "assistant") {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, content: last.content + text };
        return updated;
      }
      // Create new assistant block
      return [...prev, { type: "assistant", content: text }];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isStreaming) return;

    const userMessage = input.trim();
    const currentFiles = [...files];
    const fileNames = currentFiles.map((f) => f.name);

    setInput("");
    setFiles([]);
    setBlocks((prev) => [...prev, {
      type: "user",
      content: userMessage,
      fileNames: fileNames.length > 0 ? fileNames : undefined,
    }]);
    setIsStreaming(true);

    try {
      let res: Response;

      if (currentFiles.length > 0) {
        const formData = new FormData();
        formData.append("message", userMessage);
        formData.append("model", model);
        if (sessionId) formData.append("sessionId", sessionId);
        for (const file of currentFiles) {
          formData.append("files", file);
        }
        res = await fetch(`/api/agent/${agentName}/chat`, {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch(`/api/agent/${agentName}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, sessionId, model }),
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
              appendToLastAssistant(data);
            } else if (currentEvent === "tool_start") {
              const { name } = JSON.parse(data);
              setBlocks((prev) => [...prev, { type: "tool", name, done: false }]);
            } else if (currentEvent === "tool_input") {
              const input = data;
              setBlocks((prev) => {
                // Find last tool block and update its input
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].type === "tool") {
                    updated[i] = { ...(updated[i] as ChatBlock & { type: "tool" }), input };
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
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4">
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
        {blocks.map((block, i) => {
          if (block.type === "user") {
            return (
              <div key={i} className="flex justify-end animate-fade-in-up">
                <div className="max-w-[80%] rounded-sm px-4 py-3 bg-amber/10 border border-amber/20 text-foreground">
                  {block.fileNames && block.fileNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {block.fileNames.map((name, j) => (
                        <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber/5 border border-amber/15 rounded-sm font-mono text-[10px] text-amber/70">
                          <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
                            <path d="M9 1v4h4" />
                          </svg>
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{block.content}</p>
                </div>
              </div>
            );
          }

          if (block.type === "tool") {
            const label = formatToolInput(block.name, block.input);
            return (
              <div key={i} className="flex justify-start pl-2 animate-slide-in-left">
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

      {/* Attachments preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pb-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber/5 border border-amber/20 rounded-sm font-mono text-[11px] text-amber/80">
              <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
                <path d="M9 1v4h4" />
              </svg>
              {f.name}
              <button type="button" onClick={() => removeFile(i)} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors">x</button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border pt-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          {hasMessages && !isStreaming && (
            <button
              type="button"
              onClick={() => { setBlocks([]); setSessionId(null); clearChat(agentName); }}
              className="px-3 py-2.5 bg-card border border-border rounded-sm font-mono text-[10px] text-muted-foreground tracking-wider uppercase hover:border-amber/30 hover:text-foreground transition-colors"
              title="Clear chat"
            >
              Clear
            </button>
          )}
          <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
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
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              localStorage.setItem(MODEL_STORAGE_KEY, e.target.value);
            }}
            disabled={isStreaming}
            className="bg-card border border-border rounded-sm px-2.5 py-2.5 font-mono text-[10px] text-muted-foreground tracking-wider uppercase hover:border-amber/30 hover:text-foreground focus:outline-none focus:border-amber/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors appearance-none cursor-pointer"
            title="Select model"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
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
