import { existsSync, rmSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";
import { getAgentsDir } from "@digitalpresence/cliclaw-auth";
import { jobSchema, parseBody } from "@/lib/validation";
import { applyRateLimit, API_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rl = applyRateLimit(request, API_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const user = await requireAuth();
    const { agentName, jobId } = await parseBody(request, jobSchema);

    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");
    const job = agent.cronJobs.find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Job not found");

    const runsDir = join(getAgentsDir(), agentName, "cron", jobId, "runs");
    if (existsSync(runsDir)) {
      rmSync(runsDir, { recursive: true });
    }

    return Response.json({ status: "cleared", agentName, jobId });
  } catch (err) {
    return errorResponse(err);
  }
}
