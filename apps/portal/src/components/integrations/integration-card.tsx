"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { IntegrationStatus } from "@/lib/types";

interface IntegrationCardProps {
  integration: IntegrationStatus;
  onConnect: (id: string, account: string) => void;
  onDisconnect: (id: string, account: string) => void;
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const [newAccountName, setNewAccountName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  function handleAddAccount() {
    const name = newAccountName.trim() || "default";
    onConnect(integration.id, name);
  }

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${
              integration.connected ? "bg-green-500" : "bg-muted-foreground/30"
            }`}
          />
          <p className="font-mono text-sm">{integration.displayName}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          Add account
        </Button>
      </div>

      {/* Connected accounts */}
      {integration.accounts.length > 0 && (
        <div className="ml-5 space-y-2">
          {integration.accounts.map((acc) => (
            <div
              key={acc.account}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">
                  {acc.account}
                </span>
                {acc.email && (
                  <span className="text-xs text-muted-foreground">
                    ({acc.email})
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDisconnect(integration.id, acc.account)}
                className="text-muted-foreground hover:text-destructive h-7 text-xs"
              >
                Disconnect
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add account form */}
      {showAddForm && (
        <div className="ml-5 mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Account name (e.g. personal)"
            className="flex-1 rounded-sm border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddAccount();
            }}
          />
          <Button size="sm" onClick={handleAddAccount}>
            Connect
          </Button>
        </div>
      )}

      {/* No accounts connected */}
      {integration.accounts.length === 0 && !showAddForm && (
        <p className="ml-5 text-xs text-muted-foreground">No accounts connected</p>
      )}
    </div>
  );
}
