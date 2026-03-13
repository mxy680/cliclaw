import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { agentFetch } from "@/lib/agent-api";
import { AgentCard } from "@/components/agent-card";
import { SignOutButton } from "@/components/sign-out-button";

interface AgentInfo {
  name: string;
  displayName: string;
  role: string;
}

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Get user's accessible agents
  const { data: access } = await supabase
    .from("client_agent_access")
    .select("agent_name")
    .eq("user_id", user.id);

  const agentNames = new Set((access ?? []).map((a: { agent_name: string }) => a.agent_name));

  // Get available agents from agent server
  let agents: AgentInfo[] = [];
  try {
    const res = await agentFetch("/agents");
    if (res.ok) {
      const data = await res.json();
      agents = (data.agents as AgentInfo[]).filter((a) => agentNames.has(a.name));
    }
  } catch {
    // Agent server unreachable
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="font-mono text-lg font-bold tracking-tight text-amber">cliclaw</h1>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="font-mono text-sm text-muted-foreground tracking-wider uppercase mb-6">
          Your Agents
        </h2>
        {agents.length === 0 ? (
          <div className="rounded-sm border border-border bg-card p-8 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              No agents assigned to your account yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
