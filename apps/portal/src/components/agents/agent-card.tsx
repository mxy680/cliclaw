import Link from "next/link";

interface AgentCardProps {
  agent: {
    name: string;
    displayName: string;
    role: string;
  };
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/chat/${agent.name}`}
      className="block rounded-sm border border-border bg-card p-4 transition-colors hover:border-amber/30 group"
    >
      <h3 className="font-mono text-sm font-semibold tracking-wide group-hover:text-amber transition-colors">
        {agent.displayName}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
        {agent.role}
      </p>
    </Link>
  );
}
