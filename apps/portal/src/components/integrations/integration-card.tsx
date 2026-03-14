"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { IntegrationStatus } from "@/lib/types";

interface IntegrationCardProps {
  integration: IntegrationStatus;
  onConnect: (id: string, account: string) => void;
  onDisconnect: (id: string, account: string) => void;
  onRename: (id: string, account: string, newName: string) => void;
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onRename,
}: IntegrationCardProps) {
  const [newAccountName, setNewAccountName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function handleAddAccount() {
    const name = newAccountName.trim() || "default";
    onConnect(integration.id, name);
  }

  function startRename(account: string) {
    setEditingAccount(account);
    setRenameValue(account);
  }

  function submitRename(oldName: string) {
    const newName = renameValue.trim();
    if (newName && newName !== oldName) {
      onRename(integration.id, oldName, newName);
    }
    setEditingAccount(null);
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
                {editingAccount === acc.account ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitRename(acc.account)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(acc.account);
                      if (e.key === "Escape") setEditingAccount(null);
                    }}
                    autoFocus
                    className="w-32 rounded-sm border border-border bg-background px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  <button
                    onClick={() => startRename(acc.account)}
                    className="font-mono text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Click to rename"
                  >
                    {acc.account}
                  </button>
                )}
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
