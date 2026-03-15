import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import { Header } from "@/components/layout/header";
import { IntegrationGrid } from "@/components/integrations/integration-grid";
import type { ClientTokenRow, IntegrationStatus } from "@/lib/types";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; account?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const { connected, account, error } = await searchParams;

  const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];

  // Group tokens by integration
  const tokensByIntegration = new Map<
    string,
    Array<{ account: string; email?: string }>
  >();
  for (const t of tokens) {
    const list = tokensByIntegration.get(t.integration) || [];
    list.push({ account: t.account, email: t.email || undefined });
    tokensByIntegration.set(t.integration, list);
  }

  const integrations: IntegrationStatus[] = Object.values(INTEGRATIONS).map((i) => {
    const accounts = tokensByIntegration.get(i.id) || [];
    return {
      id: i.id,
      displayName: i.displayName,
      connected: accounts.length > 0,
      email: accounts[0]?.email,
      accounts,
      authType: i.authType,
      tokenUrl: i.tokenUrl,
    };
  });

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
          justConnectedAccount={account}
        />
      </div>
    </>
  );
}
