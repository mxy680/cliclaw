import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { agentFetch } from "@/lib/agent-api";
import { PortalChat } from "@/components/portal-chat";
import { MissingIntegrationsBanner } from "@/components/missing-integrations-banner";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

interface AgentInfo {
  name: string;
  displayName: string;
  role: string;
}

interface IntegrationStatus {
  id: string;
  displayName: string;
  connected: boolean;
}

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ agentName: string }>;
}) {
  const { agentName } = await params;
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

  // Check which integrations this agent needs that the user hasn't connected
  let missingIntegrations: string[] = [];
  try {
    const res = await agentFetch(`/integrations/agent/${agentName}`, { sessionToken: session });
    if (res.ok) {
      const data = (await res.json()) as { integrations: IntegrationStatus[] };
      missingIntegrations = data.integrations
        .filter((i) => !i.connected)
        .map((i) => i.displayName);
    }
  } catch {}

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
          <Link
            href="/integrations"
            className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:text-amber transition-colors"
          >
            Integrations
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="flex-1 flex flex-col mx-auto w-full max-w-4xl px-6 py-6 gap-4">
        {missingIntegrations.length > 0 && (
          <MissingIntegrationsBanner missing={missingIntegrations} />
        )}
        <PortalChat agentName={agent.name} displayName={agent.displayName} />
      </div>
    </div>
  );
}
