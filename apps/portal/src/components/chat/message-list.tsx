"use client";

import { useEffect, useRef } from "react";
import type { ChatBlock } from "@/lib/types";
import { MessageBubble } from "./message-bubble";
import { ToolCallIndicator } from "./tool-call-indicator";

interface MessageListProps {
  blocks: ChatBlock[];
  isStreaming: boolean;
}

export function MessageList({ blocks, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [blocks]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {blocks.map((block, i) => {
        if (block.type === "tool") {
          return (
            <ToolCallIndicator
              key={i}
              name={block.name}
              input={block.input}
              done={block.done}
            />
          );
        }
        return (
          <MessageBubble
            key={i}
            type={block.type}
            content={block.content}
            isStreaming={
              isStreaming &&
              block.type === "assistant" &&
              i === blocks.length - 1
            }
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
