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

    const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];
    const connectedPairs = new Set(
      tokens.map((t) => `${t.integration}:${t.account}`)
    );

    // Return required (integration, account) pairs with connection status
    const integrations = agent.permissions.map((p) => {
      const def = INTEGRATIONS[p.integration];
      return {
        id: p.integration,
        account: p.account,
        displayName: def?.displayName || p.integration,
        connected: connectedPairs.has(`${p.integration}:${p.account}`),
        email:
          tokens.find(
            (t) => t.integration === p.integration && t.account === p.account
          )?.email || undefined,
      };
    });

    return Response.json({ integrations });
  } catch (err) {
    return errorResponse(err);
  }
}
