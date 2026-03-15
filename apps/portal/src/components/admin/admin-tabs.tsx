"use client";

import { useState } from "react";
import { OverviewTab } from "./overview-tab";
import { UsersTab } from "./users-tab";
import { AgentsTab } from "./agents-tab";
import { SessionsTab } from "./sessions-tab";
import type {
  UserWithStats,
  SessionWithEmail,
  RecentGrant,
  RecentSession,
  AgentWithStats,
} from "./types";

const TABS = ["Overview", "Users", "Agents", "Sessions"] as const;
type Tab = (typeof TABS)[number];

interface AdminTabsProps {
  stats: {
    totalUsers: number;
    totalAgents: number;
    totalSessions: number;
  };
  users: UserWithStats[];
  sessions: SessionWithEmail[];
  recentGrants: RecentGrant[];
  recentSessions: RecentSession[];
  agents: AgentWithStats[];
}

export function AdminTabs({
  stats,
  users,
  sessions,
  recentGrants,
  recentSessions,
  agents,
}: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-mono text-sm tracking-wide transition-colors relative ${
              activeTab === tab
                ? "text-amber"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber" />
            )}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && (
        <OverviewTab
          stats={stats}
          recentGrants={recentGrants}
          recentSessions={recentSessions}
        />
      )}
      {activeTab === "Users" && <UsersTab users={users} />}
      {activeTab === "Agents" && <AgentsTab agents={agents} />}
      {activeTab === "Sessions" && (
        <SessionsTab sessions={sessions} agents={agents} users={users} />
      )}
    </div>
  );
}
