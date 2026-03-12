import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const store = new AgentStore(getAgentsDir());
  const agents = store.list();

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-light tracking-wide text-foreground">Agents</h1>
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider mt-1">
            / WORKSPACES
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage agent workspaces. Chat with agents via Claude Code.
        </p>
      </div>

      <Separator className="bg-border mb-8" />

      <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        {agents.length === 0 ? (
          <div className="border border-border rounded-sm p-10 text-center">
            <p className="font-mono text-sm text-muted-foreground">No agents configured.</p>
            <p className="font-mono text-[10px] text-muted-foreground/50 mt-2 tracking-wider uppercase">
              Create agents via the CLI to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Link
                key={agent.name}
                href={`/agents/${agent.name}/chat`}
                className="border border-border bg-card rounded-sm p-5 hover:border-amber/30 transition-colors group block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-medium text-foreground group-hover:text-amber transition-colors">
                      {agent.displayName}
                    </h2>
                    <p className="font-mono text-[10px] text-muted-foreground tracking-wider mt-0.5 uppercase">
                      {agent.name}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-amber/50 tracking-wider group-hover:text-amber transition-colors">
                    CHAT →
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mb-4 leading-relaxed line-clamp-2">
                  {agent.role}
                </p>

                <div className="flex items-center gap-4 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="size-1 rounded-full bg-amber/50" />
                    <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
                      {agent.permissions.length} PERMISSIONS
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="size-1 rounded-full bg-amber/50" />
                    <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
                      {agent.memory.length} MEMORIES
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
