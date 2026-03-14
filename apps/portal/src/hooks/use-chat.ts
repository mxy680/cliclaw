"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatBlock } from "@/lib/types";

function storageKey(agentName: string) {
  return `chat:${agentName}`;
}

function loadSession(agentName: string): { blocks: ChatBlock[]; sessionId: string | null } {
  try {
    const raw = sessionStorage.getItem(storageKey(agentName));
    if (!raw) return { blocks: [], sessionId: null };
    const data = JSON.parse(raw);
    return {
      blocks: data.blocks || [],
      sessionId: data.sessionId || null,
    };
  } catch {
    return { blocks: [], sessionId: null };
  }
}

function saveSession(agentName: string, blocks: ChatBlock[], sessionId: string | null) {
  // Only persist user and assistant blocks (not tool indicators)
  const persistable = blocks.filter((b) => b.type === "user" || b.type === "assistant");
  sessionStorage.setItem(
    storageKey(agentName),
    JSON.stringify({ blocks: persistable, sessionId }),
  );
}

export function useChat(agentName: string) {
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);

  // Restore from sessionStorage after hydration
  useEffect(() => {
    const saved = loadSession(agentName);
    if (saved.blocks.length > 0) {
      setBlocks(saved.blocks);
    }
    sessionIdRef.current = saved.sessionId;
    hydratedRef.current = true;
  }, [agentName]);

  // Persist blocks and sessionId whenever they change (skip initial render)
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveSession(agentName, blocks, sessionIdRef.current);
  }, [agentName, blocks]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (isStreaming) return;

      setBlocks((prev) => [...prev, { type: "user", content: message }]);
      setIsStreaming(true);

      // Add empty assistant block
      setBlocks((prev) => [...prev, { type: "assistant", content: "" }]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(`/api/chat/${agentName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            ...(sessionIdRef.current ? { sessionId: sessionIdRef.current } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";
        let dataLines: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
              dataLines = [];
            } else if (line.startsWith("data: ")) {
              dataLines.push(line.slice(6));
            } else if (line === "") {
              // Empty line = end of SSE message, dispatch accumulated data
              if (currentEvent && dataLines.length > 0) {
                handleSSEEvent(currentEvent, dataLines.join("\n"));
              }
              currentEvent = "";
              dataLines = [];
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setBlocks((prev) => {
            const last = prev[prev.length - 1];
            if (last?.type === "assistant" && last.content === "") {
              return [
                ...prev.slice(0, -1),
                { type: "assistant", content: "An error occurred. Please try again." },
              ];
            }
            return prev;
          });
        }
      } finally {
        // Remove trailing empty assistant blocks
        setBlocks((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "assistant" && last.content.trim() === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [agentName, isStreaming]
  );

  function handleSSEEvent(event: string, data: string) {
    switch (event) {
      case "delta":
        setBlocks((prev) => {
          const last = prev[prev.length - 1];
          // If the last block is an assistant block, append to it
          if (last?.type === "assistant") {
            const updated = [...prev];
            updated[updated.length - 1] = {
              type: "assistant",
              content: last.content + data,
            };
            return updated;
          }
          // Otherwise (last block is a tool), create a new assistant block
          return [...prev, { type: "assistant", content: data }];
        });
        break;

      case "tool_start": {
        const parsed = JSON.parse(data);
        setBlocks((prev) => {
          // Remove trailing empty assistant block before adding tool
          const trimmed =
            prev.length > 0 &&
            prev[prev.length - 1].type === "assistant" &&
            (prev[prev.length - 1] as any).content.trim() === ""
              ? prev.slice(0, -1)
              : prev;
          return [
            ...trimmed,
            { type: "tool", name: parsed.name, done: false },
          ];
        });
        break;
      }

      case "tool_input": {
        setBlocks((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === "tool" && !(updated[i] as any).done) {
              updated[i] = { ...updated[i], input: data } as ChatBlock;
              break;
            }
          }
          return updated;
        });
        break;
      }

      case "tool_result": {
        setBlocks((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].type === "tool" && !(updated[i] as any).done) {
              updated[i] = { ...updated[i], done: true } as ChatBlock;
              break;
            }
          }
          return updated;
        });
        break;
      }

      case "session": {
        sessionIdRef.current = data;
        break;
      }

      case "error": {
        setBlocks((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            const block = updated[i];
            if (block.type === "assistant") {
              updated[i] = { type: "assistant", content: `Error: ${data}` };
              break;
            }
          }
          return updated;
        });
        break;
      }
    }
  }

  const clearChat = useCallback(() => {
    setBlocks([]);
    sessionIdRef.current = null;
    sessionStorage.removeItem(storageKey(agentName));
  }, [agentName]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { blocks, isStreaming, sendMessage, clearChat, cancel };
}
