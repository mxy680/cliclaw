"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { MemoryPanel } from "@/components/memory-panel";

export function ChatLayout({ agentName, displayName }: { agentName: string; displayName: string }) {
  const [showMemory, setShowMemory] = useState(false);

  return (
    <div className="flex flex-1 min-h-0 gap-0">
      {/* Chat */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        <ChatInterface agentName={agentName} displayName={displayName} />
      </div>

      {/* Memory toggle button (fixed to right edge) */}
      <div className="flex flex-col items-center pt-2 pl-2">
        <button
          onClick={() => setShowMemory(!showMemory)}
          className={`flex items-center gap-1.5 px-2 py-1.5 border rounded-sm font-mono text-[10px] tracking-wider uppercase transition-colors ${
            showMemory
              ? "bg-amber/10 border-amber/30 text-amber"
              : "bg-card border-border text-muted-foreground hover:border-amber/30 hover:text-foreground"
          }`}
          title={showMemory ? "Hide memory" : "Show memory"}
        >
          <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5v4M6 6.5h4" />
          </svg>
          MEM
        </button>
      </div>

      {/* Memory panel */}
      {showMemory && (
        <div className="w-72 border-l border-border bg-card flex flex-col min-h-0 animate-slide-in-right">
          <MemoryPanel agentName={agentName} />
        </div>
      )}
    </div>
  );
}
