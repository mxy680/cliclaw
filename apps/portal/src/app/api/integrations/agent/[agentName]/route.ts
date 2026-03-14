import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import { getAgentStore } from "@/lib/agents";
import type { ClientTokenRow } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentName: string }> }
) {
  try {
    const user = await requireAuth();
    const { agentName } = await params;

    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");

    const requiredIntegrations = new Set(
      agent.permissions
        .filter((p) => p.account === "client")
        .map((p) => p.integration)
    );

    const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];
    const connectedMap = new Map(tokens.map((t) => [t.integration, t.email]));

    const integrations = Object.values(INTEGRATIONS).filter((i) =>
      requiredIntegrations.has(i.id)
    ).map((i) => ({
      id: i.id,
      displayName: i.displayName,
      connected: connectedMap.has(i.id),
      email: connectedMap.get(i.id) || undefined,
    }));

    return Response.json({ integrations });
  } catch (err) {
    return errorResponse(err);
  }
}
