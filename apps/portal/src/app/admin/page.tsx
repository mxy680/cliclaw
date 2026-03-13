import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { agentFetch } from "@/lib/agent-api";
import { AdminPanel } from "@/components/admin-panel";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

interface AgentInfo {
  name: string;
  displayName: string;
}

interface AccessEntry {
  id: string;
  user_id: string;
  agent_name: string;
  granted_at: string;
  granted_by: string;
  user_email: string;
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) redirect("/");

  // Verify session and check admin
  const sessionRes = await agentFetch("/auth/session", { sessionToken: session });
  if (!sessionRes.ok) redirect("/");
  const { user } = await sessionRes.json() as { user: { email: string } };

  // Get admin data
  const [accessRes, agentsRes] = await Promise.all([
    agentFetch("/admin/access", { sessionToken: session }),
    agentFetch("/agents", { sessionToken: session }),
  ]);

  // If not admin, redirect
  if (accessRes.status === 403) redirect("/chat");

  const accessData = accessRes.ok ? await accessRes.json() : { access: [] };
  const agentsData = agentsRes.ok ? await agentsRes.json() : { agents: [] };

  // Build access list with emails already included from server
  const access = (accessData.access ?? []) as AccessEntry[];
  const agents = (agentsData.agents ?? []) as AgentInfo[];

  // For admin, we need ALL agents, not just accessible ones.
  // Fetch the full list — admin should see all agents.
  // The /agents endpoint filters by access, so for admin we get all agents from a separate admin endpoint.
  // For now, we'll use what we have — admin can type agent names manually.

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/chat" className="font-mono text-lg font-bold tracking-tight text-amber hover:text-amber/80 transition-colors">
            cliclaw
          </Link>
          <span className="text-border">/</span>
          <span className="font-mono text-sm text-foreground">admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <AdminPanel
          access={access}
          agents={agents}
        />
      </div>
    </div>
  );
}
