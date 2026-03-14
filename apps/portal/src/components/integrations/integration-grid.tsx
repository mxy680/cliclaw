"use client";

import { useState, useEffect } from "react";
import { IntegrationCard } from "./integration-card";
import { toast } from "@/components/ui/toast";
import type { IntegrationStatus } from "@/lib/types";

interface IntegrationGridProps {
  initialIntegrations: IntegrationStatus[];
  justConnected?: string;
  justConnectedAccount?: string;
}

export function IntegrationGrid({
  initialIntegrations,
  justConnected,
  justConnectedAccount,
}: IntegrationGridProps) {
  const [integrations, setIntegrations] =
    useState<IntegrationStatus[]>(initialIntegrations);

  useEffect(() => {
    if (justConnected) {
      const name = integrations.find((i) => i.id === justConnected)?.displayName;
      const label = justConnectedAccount && justConnectedAccount !== "default"
        ? `${name} (${justConnectedAccount})`
        : name;
      if (label) toast(`${label} connected`, "success");
    }
  }, [justConnected, justConnectedAccount]);

  const connectedCount = integrations.reduce(
    (sum, i) => sum + i.accounts.length,
    0
  );

  function handleConnect(id: string, account: string) {
    window.location.href = `/api/integrations/connect/${id}?account=${encodeURIComponent(account)}`;
  }

  async function handleDisconnect(id: string, account: string) {
    const res = await fetch(
      `/api/integrations/disconnect/${id}?account=${encodeURIComponent(account)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setIntegrations((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;
          const accounts = i.accounts.filter((a) => a.account !== account);
          return {
            ...i,
            connected: accounts.length > 0,
            email: accounts[0]?.email,
            accounts,
          };
        })
      );
      toast("Disconnected", "info");
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {connectedCount} account{connectedCount !== 1 ? "s" : ""} connected
        across {integrations.length} integration{integrations.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>
    </div>
  );
}
