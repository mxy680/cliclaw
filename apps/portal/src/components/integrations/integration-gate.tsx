"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface IntegrationGateProps {
  missing: Array<{ id: string; account: string; displayName: string }>;
}

export function IntegrationGate({ missing }: IntegrationGateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-sm text-center">
        <h2 className="font-mono text-lg font-semibold mb-2">
          Integrations Required
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect the following integrations to chat with this agent:
        </p>
        <ul className="mb-6 space-y-2">
          {missing.map((m) => (
            <li
              key={`${m.id}:${m.account}`}
              className="flex items-center gap-2 justify-center text-sm"
            >
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span>
                {m.displayName}
                {m.account !== "default" && (
                  <span className="text-muted-foreground ml-1">
                    ({m.account})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/integrations">
          <Button>Connect Integrations</Button>
        </Link>
      </div>
    </div>
  );
}
