"use client";

import { useState, useCallback } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { ChatSidebar } from "@/components/chat-sidebar";
import { CronRunViewer } from "@/components/cron-run-viewer";
import type { ChatSession, ChatSessionSummary, CronJobWithRuns } from "./page";

interface CronRunLog {
  jobId: string;
  agentName: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  completed: boolean;
  totalCostUsd: number;
  error?: string;
  transcript?: Array<
    | { type: "assistant"; content: string }
    | { type: "tool"; name: string; input?: string; done: boolean }
  >;
}

interface ChatPageClientProps {
  agentName: string;
  displayName: string;
  initialChats: ChatSessionSummary[];
  cronJobs: CronJobWithRuns[];
  saveChatAction: (agentName: string, session: ChatSession) => Promise<void>;
  listChatsAction: (agentName: string) => Promise<ChatSessionSummary[]>;
  getChatAction: (agentName: string, sessionId: string) => Promise<ChatSession | null>;
  deleteChatAction: (agentName: string, sessionId: string) => Promise<void>;
  getCronRunLogAction: (agentName: string, jobId: string, startedAt: string) => Promise<{ log: CronRunLog; output: string | null } | null>;
}

export function ChatPageClient({
  agentName,
  displayName,
  initialChats,
  cronJobs,
  saveChatAction,
  listChatsAction,
  getChatAction,
  deleteChatAction,
  getCronRunLogAction,
}: ChatPageClientProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>(initialChats);
  const [initialSession, setInitialSession] = useState<ChatSession | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [viewingCronRun, setViewingCronRun] = useState<{ log: CronRunLog; output: string | null } | null>(null);
  const [activeCronRunKey, setActiveCronRunKey] = useState<string | null>(null);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    setViewingCronRun(null);
    setActiveCronRunKey(null);
    const session = await getChatAction(agentName, sessionId);
    if (session) {
      setInitialSession(session);
      setActiveSessionId(sessionId);
    }
  }, [agentName, getChatAction]);

  const handleNewChat = useCallback(() => {
    setInitialSession(null);
    setActiveSessionId(null);
    setViewingCronRun(null);
    setActiveCronRunKey(null);
    setChatKey((k) => k + 1);
  }, []);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteChatAction(agentName, sessionId);
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    if (activeSessionId === sessionId) {
      setInitialSession(null);
      setActiveSessionId(null);
    }
  }, [agentName, activeSessionId, deleteChatAction]);

  const handleSessionChange = useCallback((sessionId: string | null) => {
    setActiveSessionId(sessionId);
  }, []);

  const refreshSessions = useCallback(async () => {
    const updated = await listChatsAction(agentName);
    setSessions(updated);
  }, [agentName, listChatsAction]);

  const handleLoadCronRun = useCallback(async (jobId: string, startedAt: string) => {
    const key = `${jobId}-${startedAt}`;
    if (activeCronRunKey === key) return;
    const log = await getCronRunLogAction(agentName, jobId, startedAt);
    if (log) {
      setViewingCronRun(log);
      setActiveCronRunKey(key);
      setActiveSessionId(null);
      setInitialSession(null);
    }
  }, [agentName, activeCronRunKey, getCronRunLogAction]);

  return (
    <div className="flex flex-1 min-h-0 gap-0">
      <ChatSidebar
        sessions={sessions}
        cronJobs={cronJobs}
        activeSessionId={activeSessionId}
        activeCronRunKey={activeCronRunKey}
        onLoadSession={handleLoadSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onLoadCronRun={handleLoadCronRun}
      />
      <div className="flex-1 min-w-0 min-h-0 pl-4 flex flex-col">
        {viewingCronRun ? (
          <CronRunViewer run={viewingCronRun.log} output={viewingCronRun.output} displayName={displayName} />
        ) : (
          <ChatInterface
            key={chatKey}
            agentName={agentName}
            displayName={displayName}
            saveChatAction={saveChatAction}
            initialSession={initialSession}
            onSessionChange={handleSessionChange}
            onChatSaved={refreshSessions}
          />
        )}
      </div>
    </div>
  );
}
