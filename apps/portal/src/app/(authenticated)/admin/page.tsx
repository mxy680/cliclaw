import { requireAdmin } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { getAgentStore } from "@/lib/agents";
import { Header } from "@/components/layout/header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import type {
  UserWithStats,
  SessionWithEmail,
  RecentGrant,
  RecentSession,
  AgentWithStats,
} from "@/components/admin/types";

export default async function AdminPage() {
  await requireAdmin();

  const stmts = getStmts();
  const agentStore = getAgentStore();

  // Stats
  const stats = {
    totalUsers: (stmts.countUsers.get() as any).count,
    totalAgents: agentStore.list().length,
    totalSessions: (stmts.countSessions.get() as any).count,
  };

  // Users with stats
  const users = stmts.listUsersWithStats.all() as UserWithStats[];

  // Sessions
  const sessions = stmts.listRecentSessions.all() as SessionWithEmail[];

  // Activity feed
  const recentGrants = stmts.recentAccessGrants.all() as RecentGrant[];
  const recentSessions = stmts.recentChatSessions.all() as RecentSession[];

  // Agent stats
  const sessionsByAgent = stmts.countSessionsByAgent.all() as Array<{
    agent_name: string;
    session_count: number;
    total_cost: number;
  }>;
  const usersByAgent = stmts.countUsersByAgent.all() as Array<{
    agent_name: string;
    user_count: number;
  }>;
  const accessList = stmts.listAccess.all() as Array<{
    user_id: string;
    email: string;
    agent_name: string;
    granted_at: string;
  }>;

  const sessionsByAgentMap = Object.fromEntries(
    sessionsByAgent.map((r) => [r.agent_name, r])
  );
  const usersByAgentMap = Object.fromEntries(
    usersByAgent.map((r) => [r.agent_name, r])
  );

  const agents: AgentWithStats[] = agentStore.list().map((a: any) => ({
    name: a.name,
    displayName: a.displayName,
    role: a.role,
    integrations: a.integrations || [],
    cronJobs: a.cronJobs?.length || 0,
    userCount: usersByAgentMap[a.name]?.user_count || 0,
    sessionCount: sessionsByAgentMap[a.name]?.session_count || 0,
    totalCost: sessionsByAgentMap[a.name]?.total_cost || 0,
    users: accessList
      .filter((acc) => acc.agent_name === a.name)
      .map((acc) => ({
        user_id: acc.user_id,
        email: acc.email,
        granted_at: acc.granted_at,
      })),
  }));

  return (
    <>
      <Header title="Admin" />
      <div className="p-6">
        <AdminTabs
          stats={stats}
          users={users}
          sessions={sessions}
          recentGrants={recentGrants}
          recentSessions={recentSessions}
          agents={agents}
        />
      </div>
    </>
  );
}
