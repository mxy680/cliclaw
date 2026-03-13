import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { agentFetch } from "@/lib/agent-api";
import { AgentCard } from "@/components/agent-card";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

interface AgentInfo {
  name: string;
  displayName: string;
  role: string;
}

export default async function ChatPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) redirect("/");

  // Get user info
  const sessionRes = await agentFetch("/auth/session", { sessionToken: session });
  if (!sessionRes.ok) redirect("/");
  const { user } = await sessionRes.json() as { user: { email: string } };

  // Check if user has completed integration onboarding
  try {
    const intRes = await agentFetch("/integrations", { sessionToken: session });
    if (intRes.ok) {
      const intData = (await intRes.json()) as {
        integrations: { connected: boolean }[];
      };
      const hasAny = intData.integrations.some((i) => i.connected);
      if (!hasAny) redirect("/integrations?welcome=1");
    }
  } catch {}

  // Get accessible agents
  let agents: AgentInfo[] = [];
  try {
    const res = await agentFetch("/agents", { sessionToken: session });
    if (res.ok) {
      const data = await res.json();
      agents = data.agents as AgentInfo[];
    }
  } catch {
    // Agent server unreachable
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="font-mono text-lg font-bold tracking-tight text-amber">cliclaw</h1>
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
