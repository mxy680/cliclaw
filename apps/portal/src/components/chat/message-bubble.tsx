"use client";

import { MarkdownRenderer } from "./markdown-renderer";
import { Spinner } from "@/components/ui/spinner";

interface MessageBubbleProps {
  type: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ type, content, isStreaming }: MessageBubbleProps) {
  if (type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-sm border border-amber/20 bg-amber/10 px-4 py-2 text-sm">
          {content}
        </div>
      </div>
    );
  }

  // Assistant
  const isEmpty = !content || content.trim() === "";

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-sm border border-border bg-card px-4 py-2">
        {isEmpty && isStreaming ? (
          <Spinner />
        ) : (
          <div className={isStreaming ? "streaming-cursor" : ""}>
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
