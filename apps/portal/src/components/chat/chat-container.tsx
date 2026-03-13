"use client";

import { useChat } from "@/hooks/use-chat";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

interface ChatContainerProps {
  agentName: string;
  displayName: string;
}

export function ChatContainer({ agentName, displayName }: ChatContainerProps) {
  const { blocks, isStreaming, sendMessage, clearChat } = useChat(agentName);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {blocks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="font-mono text-2xl font-bold text-amber/60">
              {displayName}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Send a message to start chatting
            </p>
          </div>
        </div>
      ) : (
        <MessageList blocks={blocks} isStreaming={isStreaming} />
      )}
      <ChatInput
        onSend={sendMessage}
        onClear={clearChat}
        isStreaming={isStreaming}
        hasMessages={blocks.length > 0}
      />
    </div>
  );
}
