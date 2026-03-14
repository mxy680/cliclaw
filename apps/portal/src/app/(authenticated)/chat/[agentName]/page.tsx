import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import { getAgentStore } from "@/lib/agents";
import { Header } from "@/components/layout/header";
import { ChatContainer } from "@/components/chat/chat-container";
import { IntegrationGate } from "@/components/integrations/integration-gate";
import type { ClientTokenRow } from "@/lib/types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ agentName: string }>;
}) {
  const user = await requireAuth();
  const { agentName } = await params;

  // Check access
  const hasAccess = getStmts().checkAccess.get(user.id, agentName);
  if (!hasAccess) redirect("/agents");

  // Load agent
  const agent = getAgentStore().get(agentName);
  if (!agent) redirect("/agents");

  // Check required integrations — user needs at least one account per integration
  // Skip in dev mode so dev-login can reach the chat without OAuth tokens
  const requiredIntegrations = agent.integrations;

  if (requiredIntegrations.length > 0 && process.env.NODE_ENV !== "development") {
    const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];
    const connectedIntegrations = new Set(
      tokens.map((t) => t.integration)
    );
    const missing = requiredIntegrations
      .filter((integration) => !connectedIntegrations.has(integration))
      .map((integration) => {
        const def = INTEGRATIONS[integration];
        return {
          id: integration,
          account: "default",
          displayName: def?.displayName || integration,
        };
      });

    if (missing.length > 0) {
      return (
        <>
          <Header
            title={agent.displayName}
            breadcrumb={[{ label: "Agents", href: "/agents" }]}
          />
          <IntegrationGate missing={missing} />
        </>
      );
    }
  }

  return (
    <>
      <Header
        title={agent.displayName}
        breadcrumb={[{ label: "Agents", href: "/agents" }]}
      />
      <ChatContainer
        agentName={agentName}
        displayName={agent.displayName}
      />
    </>
  );
}
