import { requireAdmin } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";

export async function GET() {
  try {
    await requireAdmin();

    const stmts = getStmts();
    const totalUsers = (await stmts.countUsers.get() as any).count;
    const totalSessions = (await stmts.countSessions.get() as any).count;
    const totalCostUsd = (await stmts.totalCost.get() as any).total;
    const totalAccess = (await stmts.countAccess.get() as any).count;
    const totalAgents = getAgentStore().list().length;

    return Response.json({
      totalUsers,
      totalAgents,
      totalSessions,
      totalCostUsd,
      totalAccess,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
