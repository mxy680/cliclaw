"use client";

import { useState, useCallback } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { ChatSidebar } from "@/components/chat-sidebar";
import type { ChatSession, ChatSessionSummary, CronJobWithRuns } from "./page";

interface ChatPageClientProps {
  agentName: string;
  displayName: string;
  initialChats: ChatSessionSummary[];
  cronJobs: CronJobWithRuns[];
  saveChatAction: (agentName: string, session: ChatSession) => Promise<void>;
  listChatsAction: (agentName: string) => Promise<ChatSessionSummary[]>;
  getChatAction: (agentName: string, sessionId: string) => Promise<ChatSession | null>;
  deleteChatAction: (agentName: string, sessionId: string) => Promise<void>;
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
}: ChatPageClientProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>(initialChats);
  const [initialSession, setInitialSession] = useState<ChatSession | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    const session = await getChatAction(agentName, sessionId);
    if (session) {
      setInitialSession(session);
      setActiveSessionId(sessionId);
    }
  }, [agentName, getChatAction]);

  const handleNewChat = useCallback(() => {
    setInitialSession(null);
    setActiveSessionId(null);
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

  return (
    <div className="flex flex-1 min-h-0 gap-0">
      <ChatSidebar
        sessions={sessions}
        cronJobs={cronJobs}
        activeSessionId={activeSessionId}
        onLoadSession={handleLoadSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />
      <div className="flex-1 min-w-0 pl-4">
        <ChatInterface
          agentName={agentName}
          displayName={displayName}
          saveChatAction={saveChatAction}
          initialSession={initialSession}
          onSessionChange={handleSessionChange}
          onChatSaved={refreshSessions}
        />
      </div>
    </div>
  );
}
