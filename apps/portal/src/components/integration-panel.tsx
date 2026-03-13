"use client";

import { useState, useEffect, useCallback } from "react";

interface Integration {
  id: string;
  displayName: string;
  connected: boolean;
  email: string | null;
}

interface IntegrationPanelProps {
  agentName: string;
  initialConnected?: string | null;
}

export function IntegrationPanel({ agentName, initialConnected }: IntegrationPanelProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(initialConnected ? `Connected ${initialConnected}` : null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/${agentName}`);
      if (res.ok) {
        const data = (await res.json()) as { integrations: Integration[] };
        setIntegrations(data.integrations);
      }
    } catch {
      // Silently fail — panel just won't show
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function handleConnect(integration: string) {
    try {
      const res = await fetch(`/api/integrations/${agentName}/connect/${integration}`);
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        window.location.href = data.url;
      }
    } catch {
      setToast("Failed to start connection");
    }
  }

  async function handleDisconnect(integration: string) {
    try {
      const res = await fetch(`/api/integrations/${agentName}/disconnect/${integration}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setIntegrations((prev) =>
          prev.map((i) => (i.id === integration ? { ...i, connected: false, email: null } : i)),
        );
        setToast(`Disconnected ${integration}`);
      }
    } catch {
      setToast("Failed to disconnect");
    }
  }

  if (loading || integrations.length === 0) return null;

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="relative">
      {toast && (
        <div className="absolute -top-10 left-0 right-0 flex justify-center z-10 animate-fade-in-up">
          <div className="px-3 py-1.5 bg-amber/10 border border-amber/30 rounded-sm font-mono text-[11px] text-amber">
            {toast}
          </div>
        </div>
      )}
      <div className="border border-border rounded-sm bg-card">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="tracking-wider uppercase">
            Integrations
            {connectedCount > 0 && (
              <span className="ml-2 text-amber">{connectedCount} connected</span>
            )}
          </span>
          <svg
            className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </button>

        {expanded && (
          <div className="border-t border-border px-4 py-3 space-y-2">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between py-1.5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-foreground">
                    {integration.displayName}
                  </span>
                  {integration.connected && integration.email && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {integration.email}
                    </span>
                  )}
                </div>
                {integration.connected ? (
                  <button
                    onClick={() => handleDisconnect(integration.id)}
                    className="px-3 py-1 font-mono text-[10px] tracking-wider uppercase text-muted-foreground border border-border rounded-sm hover:border-red-500/30 hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.id)}
                    className="px-3 py-1 font-mono text-[10px] tracking-wider uppercase text-amber border border-amber/30 rounded-sm hover:bg-amber/10 transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
