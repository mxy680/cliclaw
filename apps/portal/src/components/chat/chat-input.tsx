"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (message: string) => void;
  onClear: () => void;
  isStreaming: boolean;
  hasMessages: boolean;
}

export function ChatInput({
  onSend,
  onClear,
  isStreaming,
  hasMessages,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    setValue("");
    onSend(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border p-4 flex items-center gap-2"
    >
      {hasMessages && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={isStreaming}
          className="text-muted-foreground"
        >
          Clear
        </Button>
      )}
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Send a message..."
        disabled={isStreaming}
        className="flex-1"
        autoFocus
      />
      <Button type="submit" disabled={!value.trim() || isStreaming} size="sm">
        Send
      </Button>
    </form>
  );
}
