"use client";

import { useState } from "react";
import Link from "next/link";

interface MissingIntegrationsBannerProps {
  missing: string[];
}

export function MissingIntegrationsBanner({ missing }: MissingIntegrationsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border border-amber/20 bg-amber/5 rounded-sm animate-fade-in-up">
      <p className="font-mono text-xs text-muted-foreground">
        This agent uses{" "}
        <span className="text-amber">{missing.join(", ")}</span>
        {" "}— connect {missing.length === 1 ? "it" : "them"} so it can act on your behalf.
      </p>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <Link
          href="/integrations"
          className="font-mono text-[10px] tracking-wider uppercase text-amber hover:text-amber/80 transition-colors"
        >
          Connect
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="font-mono text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
