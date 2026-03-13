import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { notFound } from "next/navigation";
import { ChatInterface } from "@/components/chat-interface";
import { Separator } from "@/components/ui/separator";
import { MemoryToggle } from "@/components/memory-toggle";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const store = new AgentStore(getAgentsDir());
  const agent = store.get(name);
  if (!agent) notFound();

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="mb-4 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-light tracking-wide text-foreground">{agent.displayName}</h1>
              <span className="font-mono text-[10px] text-muted-foreground tracking-wider mt-1">/ CHAT</span>
            </div>
            <p className="text-sm text-muted-foreground">{agent.role}</p>
          </div>
          <MemoryToggle agentName={agent.name} />
        </div>
      </div>
      <Separator className="bg-border mb-4" />
      <ChatInterface agentName={agent.name} displayName={agent.displayName} />
    </div>
  );
}
