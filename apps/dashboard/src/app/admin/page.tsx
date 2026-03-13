import { revalidatePath } from "next/cache";
import { Separator } from "@/components/ui/separator";
import { AdminDashboard } from "@/components/admin-dashboard";
import { agentServerFetch } from "@/lib/agent-server";

export const dynamic = "force-dynamic";

interface ClientData {
  userId: string;
  email: string;
  createdAt: string;
  agents: string[];
  totalSessions: number;
  totalTurns: number;
  totalCostUsd: number;
  lastActive: string | null;
}

interface AgentData {
  name: string;
  displayName: string;
  role: string;
  clientCount: number;
  totalSessions: number;
  totalTurns: number;
  totalCostUsd: number;
  integrations: string[];
}

interface StatsResponse {
  clients: ClientData[];
  agents: AgentData[];
  totals: {
    clients: number;
    agents: number;
    sessions: number;
    totalCostUsd: number;
  };
}

async function grantAccess(email: string, agentName: string) {
  "use server";
  await agentServerFetch("/admin/access", {
    method: "POST",
    body: JSON.stringify({ email, agentName }),
  });
  revalidatePath("/admin");
}

async function revokeAccess(userId: string, agentName: string) {
  "use server";
  await agentServerFetch("/admin/access", {
    method: "DELETE",
    body: JSON.stringify({ userId, agentName }),
  });
  revalidatePath("/admin");
}

async function createAgent(name: string, displayName: string, role: string, integrations: string[]) {
  "use server";
  await agentServerFetch("/admin/agents", {
    method: "POST",
    body: JSON.stringify({ name, displayName, role, integrations }),
  });
  revalidatePath("/admin");
}

async function updateAgent(name: string, displayName: string, role: string, integrations: string[]) {
  "use server";
  await agentServerFetch(`/admin/agents/${name}`, {
    method: "PUT",
    body: JSON.stringify({ displayName, role, integrations }),
  });
  revalidatePath("/admin");
}

async function deleteAgent(name: string) {
  "use server";
  await agentServerFetch(`/admin/agents/${name}`, { method: "DELETE" });
  revalidatePath("/admin");
}

export default async function AdminPage() {
  let stats: StatsResponse | null = null;
  let error: string | null = null;

  try {
    const res = await agentServerFetch("/admin/stats");
    if (!res.ok) {
      error = `Agent server returned ${res.status}`;
    } else {
      stats = (await res.json()) as StatsResponse;
    }
  } catch {
    error = "Could not connect to agent server";
  }

  const agentOptions = stats
    ? stats.agents.map((a) => ({ name: a.name, displayName: a.displayName }))
    : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-light tracking-wide text-foreground">Admin</h1>
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider mt-1">
            / CLIENT MANAGEMENT
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage client access, monitor usage, and control your agent business.
        </p>
      </div>

      <Separator className="bg-border mb-8" />

      {error ? (
        <div className="animate-fade-in-up border border-destructive/30 rounded-lg p-6 bg-destructive/5">
          <p className="font-mono text-sm text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Make sure the agent server is running on {process.env.AGENT_SERVER_URL || "http://localhost:3002"}
          </p>
        </div>
      ) : stats ? (
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <AdminDashboard
            clients={stats.clients}
            agents={stats.agents}
            totals={stats.totals}
            agentOptions={agentOptions}
            grantAction={grantAccess}
            revokeAction={revokeAccess}
            createAgentAction={createAgent}
            updateAgentAction={updateAgent}
            deleteAgentAction={deleteAgent}
          />
        </div>
      ) : null}
    </div>
  );
}
