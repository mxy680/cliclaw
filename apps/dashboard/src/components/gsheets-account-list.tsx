"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Account {
  name: string;
  email: string | null;
}

interface GSheetsAccountListProps {
  accounts: Account[];
  removeAction: (accountName: string) => Promise<{ success: boolean }>;
}

export function GSheetsAccountList({ accounts, removeAction }: GSheetsAccountListProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleAdd() {
    if (!adding) {
      setAdding(true);
      return;
    }
    const name = accountName.trim();
    if (!name) return;
    window.location.href = `/api/oauth/gsheets?account=${encodeURIComponent(name)}`;
  }

  async function handleRemove(name: string) {
    setRemovingId(name);
    await removeAction(name);
    router.refresh();
    setRemovingId(null);
  }

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-6">
        {adding && (
          <Input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAdding(false); setAccountName(""); }
            }}
            placeholder="Account name"
            className="w-52 font-mono text-sm bg-input border-border focus:border-amber focus:ring-amber/20"
            autoFocus
          />
        )}
        <Button
          onClick={handleAdd}
          variant={adding ? "default" : "outline"}
          size="sm"
          className={adding ? "bg-amber text-background hover:bg-amber/90 font-mono text-xs tracking-wider uppercase" : "font-mono text-xs tracking-wider uppercase border-border hover:border-amber/40 hover:text-amber"}
        >
          {adding ? "Connect" : "+ Add Account"}
        </Button>
        {adding && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAdding(false); setAccountName(""); }}
            className="font-mono text-xs text-muted-foreground"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Account list */}
      {accounts.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm py-12 flex flex-col items-center gap-3">
          <div className="size-2 rounded-full bg-muted-foreground/30" />
          <p className="font-mono text-xs text-muted-foreground tracking-wider uppercase">
            No accounts connected
          </p>
          <p className="text-sm text-muted-foreground">
            Add an account to get started with Google Sheets integration.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {accounts.map((account, i) => (
            <div
              key={account.name}
              className="group relative flex items-center justify-between py-3 px-4 bg-surface-raised border border-border rounded-sm hover:border-amber/20 transition-all duration-200 animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* Left accent */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-amber/0 group-hover:bg-amber/50 transition-colors duration-300" />

              <div className="flex items-center gap-3">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                <span className="font-mono text-sm font-medium text-foreground">
                  {account.name}
                </span>
                {account.email && (
                  <Badge variant="secondary" className="font-mono text-[10px] text-muted-foreground bg-muted border-0">
                    {account.email}
                  </Badge>
                )}
              </div>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleRemove(account.name)}
                disabled={removingId === account.name}
                className="font-mono text-[10px] text-muted-foreground hover:text-destructive tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {removingId === account.name ? "..." : "Remove"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
