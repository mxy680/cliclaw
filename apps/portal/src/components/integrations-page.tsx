"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Integration {
  id: string;
  displayName: string;
  connected: boolean;
  email: string | null;
}

interface IntegrationsPageProps {
  initialConnected?: string | null;
}

export function IntegrationsPage({ initialConnected }: IntegrationsPageProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(
    initialConnected ? `Connected ${initialConnected}` : null,
  );

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = (await res.json()) as { integrations: Integration[] };
        setIntegrations(data.integrations);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

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
      const res = await fetch(`/api/integrations/connect/${integration}`);
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
      const res = await fetch(`/api/integrations/disconnect/${integration}`, {
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

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up">
          <div className="px-4 py-2 bg-amber/10 border border-amber/30 rounded-sm font-mono text-xs text-amber">
            {toast}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono text-sm text-muted-foreground tracking-wider uppercase">
              Connected Accounts
            </h2>
            {!loading && (
              <p className="font-mono text-[11px] text-muted-foreground/60 mt-1">
                {connectedCount} of {integrations.length} integrations connected
              </p>
            )}
          </div>
          <Link
            href="/chat"
            className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:text-amber transition-colors"
          >
            Back to chats
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-sm border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between px-5 py-4 border border-border bg-card rounded-sm"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`size-2 rounded-full ${integration.connected ? "bg-amber" : "bg-border"}`}
                  />
                  <div>
                    <p className="font-mono text-sm text-foreground">
                      {integration.displayName}
                    </p>
                    {integration.connected && integration.email && (
                      <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                        {integration.email}
                      </p>
                    )}
                  </div>
                </div>
                {integration.connected ? (
                  <button
                    onClick={() => handleDisconnect(integration.id)}
                    className="px-4 py-1.5 font-mono text-[10px] tracking-wider uppercase text-muted-foreground border border-border rounded-sm hover:border-destructive/40 hover:text-destructive transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.id)}
                    className="px-4 py-1.5 font-mono text-[10px] tracking-wider uppercase text-amber border border-amber/30 rounded-sm hover:bg-amber/10 transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
