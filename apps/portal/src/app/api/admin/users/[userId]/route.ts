import { requireAdmin } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse } from "@/lib/errors";
import { applyRateLimit, API_LIMIT } from "@/lib/rate-limit";
import type { UserAgent, UserSession } from "@/components/admin/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const rl = applyRateLimit(request, API_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    await requireAdmin();
    const { userId } = await params;
    const stmts = getStmts();
    const agents = stmts.getUserAgents.all(userId) as UserAgent[];
    const sessions = stmts.getUserRecentSessions.all(userId) as UserSession[];
    return Response.json({ agents, sessions });
  } catch (err) {
    return errorResponse(err);
  }
}
