import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { agentFetch } from "@/lib/agent-api";
import { PortalChat } from "@/components/portal-chat";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

interface AgentInfo {
  name: string;
  displayName: string;
  role: string;
}

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ agentName: string }>;
}) {
  const { agentName } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Check access
  const { data: access } = await supabase
    .from("client_agent_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("agent_name", agentName)
    .single();

  if (!access) redirect("/chat");

  // Get agent info
  let agent: AgentInfo | null = null;
  try {
    const res = await agentFetch("/agents");
    if (res.ok) {
      const data = await res.json();
      agent = (data.agents as AgentInfo[]).find((a) => a.name === agentName) ?? null;
    }
  } catch {
    // Agent server unreachable
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">Agent not available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/chat" className="font-mono text-lg font-bold tracking-tight text-amber hover:text-amber/80 transition-colors">
            cliclaw
          </Link>
          <span className="text-border">/</span>
          <span className="font-mono text-sm text-foreground">{agent.displayName}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="flex-1 flex flex-col mx-auto w-full max-w-4xl px-6 py-6">
        <PortalChat agentName={agent.name} displayName={agent.displayName} />
      </div>
    </div>
  );
}
