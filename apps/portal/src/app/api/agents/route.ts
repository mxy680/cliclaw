import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";

export async function GET() {
  try {
    const user = await requireAuth();

    const accessRows = getStmts().getUserAccess.all(user.id) as {
      agent_name: string;
    }[];
    const accessSet = new Set(accessRows.map((r) => r.agent_name));

    const allAgents = getAgentStore().list();
    const agents = allAgents
      .filter((a) => accessSet.has(a.name))
      .map((a) => ({
        name: a.name,
        displayName: a.displayName,
        role: a.role,
      }));

    return Response.json({ agents });
  } catch (err) {
    return errorResponse(err);
  }
}
