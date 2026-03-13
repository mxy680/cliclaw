"use client";

import { useState, useEffect } from "react";
import { IntegrationCard } from "./integration-card";
import { toast } from "@/components/ui/toast";
import type { IntegrationStatus } from "@/lib/types";

interface IntegrationGridProps {
  initialIntegrations: IntegrationStatus[];
  justConnected?: string;
}

export function IntegrationGrid({
  initialIntegrations,
  justConnected,
}: IntegrationGridProps) {
  const [integrations, setIntegrations] =
    useState<IntegrationStatus[]>(initialIntegrations);

  useEffect(() => {
    if (justConnected) {
      const name = integrations.find((i) => i.id === justConnected)?.displayName;
      if (name) toast(`${name} connected`, "success");
    }
  }, [justConnected]);

  const connectedCount = integrations.filter((i) => i.connected).length;

  async function handleConnect(id: string) {
    window.location.href = `/api/integrations/connect/${id}`;
  }

  async function handleDisconnect(id: string) {
    const res = await fetch(`/api/integrations/disconnect/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, connected: false, email: undefined } : i
        )
      );
      toast("Disconnected", "info");
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {connectedCount} of {integrations.length} connected
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
