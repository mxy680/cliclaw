"use client";

import { useState, useRef, useCallback } from "react";
import type { ChatBlock } from "@/lib/types";

export function useChat(agentName: string) {
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
            sessionId: sessionIdRef.current,
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              handleSSEEvent(currentEvent, data);
            } else if (line === "") {
              currentEvent = "";
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
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            const block = updated[i];
            if (block.type === "assistant") {
              updated[i] = { type: "assistant", content: block.content + data };
              break;
            }
          }
          return updated;
        });
        break;

      case "tool_start": {
        const parsed = JSON.parse(data);
        setBlocks((prev) => [
          ...prev,
          { type: "tool", name: parsed.name, done: false },
        ]);
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
          // Add new assistant block for post-tool response
          return [...updated, { type: "assistant", content: "" }];
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
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { blocks, isStreaming, sendMessage, clearChat, cancel };
}
