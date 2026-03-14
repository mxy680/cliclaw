import { requireAdmin } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { getAgentStore } from "@/lib/agents";
import { Header } from "@/components/layout/header";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AccessManager } from "@/components/admin/access-manager";

export default async function AdminPage() {
  await requireAdmin();

  const stmts = getStmts();
  const stats = {
    totalUsers: (stmts.countUsers.get() as any).count,
    totalAgents: getAgentStore().list().length,
    totalSessions: (stmts.countSessions.get() as any).count,
    totalCostUsd: (stmts.totalCost.get() as any).total,
  };

  const access = stmts.listAccess.all() as Array<{
    id: string;
    user_id: string;
    email: string;
    agent_name: string;
    granted_at: string;
    granted_by: string;
  }>;

  const agents = getAgentStore().list().map((a) => ({
    name: a.name,
    displayName: a.displayName,
  }));

  return (
    <>
      <Header title="Admin" />
      <div className="p-6 space-y-8">
        <AdminOverview stats={stats} />
        <AccessManager initialAccess={access} agents={agents} />
      </div>
    </>
  );
}
