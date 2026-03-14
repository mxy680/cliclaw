import { AgentCard } from "./agent-card";

interface AgentGridProps {
  agents: Array<{
    name: string;
    displayName: string;
    role: string;
  }>;
}

export function AgentGrid({ agents }: AgentGridProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No agents assigned yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Ask an admin to grant you access.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard key={agent.name} agent={agent} />
      ))}
    </div>
  );
}
