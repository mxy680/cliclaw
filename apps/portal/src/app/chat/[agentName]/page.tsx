import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { agentFetch } from "@/lib/agent-api";
import { PortalChat } from "@/components/portal-chat";
import { IntegrationPanel } from "@/components/integration-panel";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

interface AgentInfo {
  name: string;
  displayName: string;
  role: string;
}

export default async function AgentChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentName: string }>;
  searchParams: Promise<{ connected?: string }>;
}) {
  const { agentName } = await params;
  const { connected } = await searchParams;
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) redirect("/");

  // Verify session
  const sessionRes = await agentFetch("/auth/session", { sessionToken: session });
  if (!sessionRes.ok) redirect("/");
  const { user } = await sessionRes.json() as { user: { email: string } };

  // Get agent info (the /agents endpoint already filters by access)
  let agent: AgentInfo | null = null;
  try {
    const res = await agentFetch("/agents", { sessionToken: session });
    if (res.ok) {
      const data = await res.json();
      agent = (data.agents as AgentInfo[]).find((a) => a.name === agentName) ?? null;
    }
  } catch {}

  if (!agent) {
    redirect("/chat");
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
      <div className="flex-1 flex flex-col mx-auto w-full max-w-4xl px-6 py-6 gap-4">
        <IntegrationPanel agentName={agent.name} initialConnected={connected} />
        <PortalChat agentName={agent.name} displayName={agent.displayName} />
      </div>
    </div>
  );
}
