import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import { Header } from "@/components/layout/header";
import { IntegrationGrid } from "@/components/integrations/integration-grid";
import type { ClientTokenRow, IntegrationStatus } from "@/lib/types";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const { connected, error } = await searchParams;

  const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];
  const connectedMap = new Map(tokens.map((t) => [t.integration, t.email]));

  const integrations: IntegrationStatus[] = Object.values(INTEGRATIONS).map((i) => ({
    id: i.id,
    displayName: i.displayName,
    connected: connectedMap.has(i.id),
    email: connectedMap.get(i.id) || undefined,
  }));

  return (
    <>
      <Header title="Integrations" />
      <div className="p-6">
        {error && (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        )}
        <IntegrationGrid
          initialIntegrations={integrations}
          justConnected={connected}
        />
      </div>
    </>
  );
}
