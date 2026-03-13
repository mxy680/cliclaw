import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { notFound } from "next/navigation";
import { ChatPageClient } from "./client";
import { Separator } from "@/components/ui/separator";
import type { CronJobConfig } from "@cliclaw/auth";
import type { ChatSession } from "@/components/chat-interface";

export type { ChatSession };
export type { ChatBlock } from "@/components/chat-interface";

export const dynamic = "force-dynamic";

export interface ChatSessionSummary {
  sessionId: string;
  title: string;
  updatedAt: string;
  turnCount: number;
}

interface CronRunLog {
  jobId: string;
  agentName: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  completed: boolean;
  totalCostUsd: number;
  error?: string;
}

export interface CronJobWithRuns {
  job: CronJobConfig;
  runs: CronRunLog[];
}

// --- Server Actions ---

async function saveChat(agentName: string, session: ChatSession) {
  "use server";
  const chatsDir = join(getAgentsDir(), agentName, "chats");
  if (!existsSync(chatsDir)) mkdirSync(chatsDir, { recursive: true });
  writeFileSync(
    join(chatsDir, `${session.sessionId}.json`),
    JSON.stringify(session, null, 2),
    "utf-8"
  );
}

async function listChats(agentName: string): Promise<ChatSessionSummary[]> {
  "use server";
  const chatsDir = join(getAgentsDir(), agentName, "chats");
  if (!existsSync(chatsDir)) return [];

  return readdirSync(chatsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const data = JSON.parse(readFileSync(join(chatsDir, f), "utf-8")) as ChatSession;
        return {
          sessionId: data.sessionId,
          title: data.title,
          updatedAt: data.updatedAt,
          turnCount: data.turnCount,
        };
      } catch {
        return null;
      }
    })
    .filter((s): s is ChatSessionSummary => s !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 50);
}

async function getChat(agentName: string, sessionId: string): Promise<ChatSession | null> {
  "use server";
  const filePath = join(getAgentsDir(), agentName, "chats", `${sessionId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as ChatSession;
  } catch {
    return null;
  }
}

async function deleteChat(agentName: string, sessionId: string) {
  "use server";
  const filePath = join(getAgentsDir(), agentName, "chats", `${sessionId}.json`);
  if (existsSync(filePath)) unlinkSync(filePath);
}

async function getAgentCronRuns(agentName: string): Promise<CronJobWithRuns[]> {
  "use server";
  const store = new AgentStore(getAgentsDir());
  const agent = store.get(agentName);
  if (!agent) return [];

  return (agent.cronJobs ?? []).map((job) => {
    const runsDir = join(getAgentsDir(), agentName, "cron", job.id, "runs");
    let runs: CronRunLog[] = [];
    if (existsSync(runsDir)) {
      runs = readdirSync(runsDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 5)
        .map((f) => {
          try {
            return JSON.parse(readFileSync(join(runsDir, f), "utf-8")) as CronRunLog;
          } catch {
            return null;
          }
        })
        .filter((l): l is CronRunLog => l !== null);
    }
    return { job, runs };
  });
}

// --- Page ---

export default async function AgentChatPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const store = new AgentStore(getAgentsDir());
  const agent = store.get(name);
  if (!agent) notFound();

  const [initialChats, cronJobs] = await Promise.all([
    listChats(name),
    getAgentCronRuns(name),
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="mb-4 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-light tracking-wide text-foreground">{agent.displayName}</h1>
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider mt-1">/ CHAT</span>
        </div>
        <p className="text-sm text-muted-foreground">{agent.role}</p>
      </div>
      <Separator className="bg-border mb-4" />
      <ChatPageClient
        agentName={agent.name}
        displayName={agent.displayName}
        initialChats={initialChats}
        cronJobs={cronJobs}
        saveChatAction={saveChat}
        listChatsAction={listChats}
        getChatAction={getChat}
        deleteChatAction={deleteChat}
      />
    </div>
  );
}
