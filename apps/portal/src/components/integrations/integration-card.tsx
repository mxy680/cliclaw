"use client";

import { Button } from "@/components/ui/button";
import type { IntegrationStatus } from "@/lib/types";

interface IntegrationCardProps {
  integration: IntegrationStatus;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full ${
            integration.connected ? "bg-green-500" : "bg-muted-foreground/30"
          }`}
        />
        <div>
          <p className="font-mono text-sm">{integration.displayName}</p>
          {integration.email && (
            <p className="text-xs text-muted-foreground">{integration.email}</p>
          )}
        </div>
      </div>
      {integration.connected ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDisconnect(integration.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          Disconnect
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onConnect(integration.id)}
        >
          Connect
        </Button>
      )}
    </div>
  );
}
