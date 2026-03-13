"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent, type ChangeEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatBlock =
  | { type: "user"; content: string; fileNames?: string[] }
  | { type: "assistant"; content: string }
  | { type: "tool"; name: string; input?: string; done: boolean };

export interface ChatSession {
  sessionId: string;
  title: string;
  blocks: ChatBlock[];
  createdAt: string;
  updatedAt: string;
  costUsd: number;
  turnCount: number;
}

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

interface ChatInterfaceProps {
  agentName: string;
  displayName: string;
  saveChatAction?: (agentName: string, session: ChatSession) => Promise<void>;
  initialSession?: ChatSession | null;
  onSessionChange?: (sessionId: string | null) => void;
  onChatSaved?: () => void;
}

export function ChatInterface({
  agentName,
  displayName,
  saveChatAction,
  initialSession,
  onSessionChange,
  onChatSaved,
}: ChatInterfaceProps) {
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blocksRef = useRef<ChatBlock[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const createdAtRef = useRef<string | null>(null);
  const turnCountRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Restore session when initialSession changes
  useEffect(() => {
    if (initialSession) {
      setBlocks(initialSession.blocks as ChatBlock[]);
      setSessionId(initialSession.sessionId);
      createdAtRef.current = initialSession.createdAt;
      turnCountRef.current = initialSession.turnCount;
    } else {
      setBlocks([]);
      setSessionId(null);
      createdAtRef.current = null;
      turnCountRef.current = 0;
    }
  }, [initialSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [blocks]);

  const saveCurrentChat = useCallback(async () => {
    if (!saveChatAction || !sessionIdRef.current || blocksRef.current.length === 0) return;
    const currentBlocks = blocksRef.current;
    const firstUserBlock = currentBlocks.find((b) => b.type === "user");
    const title = firstUserBlock?.type === "user"
      ? firstUserBlock.content.slice(0, 60)
      : "Untitled";

    const session: ChatSession = {
      sessionId: sessionIdRef.current,
      title,
      blocks: currentBlocks,
      createdAt: createdAtRef.current ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      costUsd: 0,
      turnCount: turnCountRef.current,
    };
    if (!createdAtRef.current) createdAtRef.current = session.createdAt;
    await saveChatAction(agentName, session);
    onChatSaved?.();
  }, [agentName, saveChatAction, onChatSaved]);

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
    turnCountRef.current += 1;

    try {
      let res: Response;

      if (currentFiles.length > 0) {
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
              const newSessionId = data;
              setSessionId(newSessionId);
              sessionIdRef.current = newSessionId;
              onSessionChange?.(newSessionId);
            } else if (currentEvent === "delta") {
              appendToLastAssistant(data);
            } else if (currentEvent === "tool_start") {
              const { name } = JSON.parse(data);
              setBlocks((prev) => [...prev, { type: "tool", name, done: false }]);
            } else if (currentEvent === "tool_input") {
              const input = data;
              setBlocks((prev) => {
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

      // Auto-save after stream completes
      // Use setTimeout to let final state updates flush
      setTimeout(() => saveCurrentChat(), 100);
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
              <div key={i} className="flex justify-end">
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
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[80%] rounded-sm px-4 py-3 bg-card border border-border text-foreground">
                <span className="font-mono text-[10px] text-amber tracking-wider uppercase block mb-1.5">
                  {displayName}
                </span>
                {block.content ? (
                  <div className="text-sm font-mono leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-foreground prose-headings:font-mono prose-headings:mt-3 prose-headings:mb-1.5 prose-strong:text-amber/90 prose-code:text-amber/80 prose-code:bg-amber/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-border prose-pre:rounded-sm prose-a:text-amber/70 prose-a:no-underline hover:prose-a:text-amber">
                    <Markdown remarkPlugins={[remarkGfm]}>{block.content}</Markdown>
                  </div>
                ) : isStreaming && i === blocks.length - 1 ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="size-1.5 rounded-full bg-amber animate-[glow-pulse_1s_ease-in-out_infinite]" />
                    <span className="font-mono text-[10px] text-muted-foreground">thinking...</span>
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
              onClick={() => {
                setBlocks([]);
                setSessionId(null);
                createdAtRef.current = null;
                turnCountRef.current = 0;
                onSessionChange?.(null);
              }}
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
