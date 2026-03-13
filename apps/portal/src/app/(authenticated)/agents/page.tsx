import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { getAgentStore } from "@/lib/agents";
import { Header } from "@/components/layout/header";
import { AgentGrid } from "@/components/agents/agent-grid";

export default async function AgentsPage() {
  const user = await requireAuth();

  const accessRows = getStmts().getUserAccess.all(user.id) as {
    agent_name: string;
  }[];
  const accessSet = new Set(accessRows.map((r) => r.agent_name));

  const allAgents = getAgentStore().list();
  const agents = allAgents
    .filter((a) => accessSet.has(a.name))
    .map((a) => ({
      name: a.name,
      displayName: a.displayName,
      role: a.role,
    }));

  return (
    <>
      <Header title="Agents" />
      <div className="p-6">
        <AgentGrid agents={agents} />
      </div>
    </>
  );
}
