"use client";

import { useState } from "react";
import { MemoryPanel } from "@/components/memory-panel";

export function MemoryToggle({ agentName }: { agentName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-sm font-mono text-[10px] tracking-wider uppercase transition-colors ${
          open
            ? "bg-amber/10 border-amber/30 text-amber"
            : "bg-card border-border text-muted-foreground hover:border-amber/30 hover:text-foreground"
        }`}
        title={open ? "Hide memory" : "Show memory"}
      >
        <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5v4M6 6.5h4" />
        </svg>
        MEM
      </button>

      {open && (
        <div className="fixed top-0 right-0 bottom-0 w-80 bg-card border-l border-border z-40 flex flex-col animate-slide-in-right">
          <MemoryPanel agentName={agentName} />
        </div>
      )}
    </>
  );
}
