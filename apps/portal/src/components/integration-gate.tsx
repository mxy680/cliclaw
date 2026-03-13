"use client";

import Link from "next/link";

interface IntegrationGateProps {
  missing: string[];
  agentDisplayName: string;
}

export function IntegrationGate({ missing, agentDisplayName }: IntegrationGateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-6 px-6">
        <div className="space-y-2">
          <h2 className="font-mono text-sm font-bold text-foreground">
            Connect your accounts
          </h2>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            {agentDisplayName} needs access to the following integrations before you can start chatting.
          </p>
        </div>
        <div className="space-y-2">
          {missing.map((name) => (
            <div
              key={name}
              className="flex items-center gap-3 px-4 py-3 border border-border bg-card rounded-sm"
            >
              <div className="size-2 rounded-full bg-border" />
              <span className="font-mono text-sm text-foreground">{name}</span>
            </div>
          ))}
        </div>
        <Link
          href="/integrations"
          className="inline-block px-6 py-2.5 font-mono text-xs tracking-wider uppercase text-amber border border-amber/30 rounded-sm hover:bg-amber/10 transition-colors"
        >
          Go to Integrations
        </Link>
      </div>
    </div>
  );
}
