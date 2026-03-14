import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import { getAgentStore } from "@/lib/agents";
import type { ClientTokenRow } from "@/lib/types";
import { safeParam } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentName: string }> }
) {
  try {
    const user = await requireAuth();
    const { agentName: rawAgentName } = await params;
    const agentName = safeParam(rawAgentName, "agentName");

    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");

    const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];
    const connectedIntegrations = new Set(
      tokens.map((t) => t.integration)
    );

    // Check that the user has at least one account per required integration
    const requiredIntegrations = agent.integrations;
    const integrations = requiredIntegrations.map((integration) => {
      const def = INTEGRATIONS[integration];
      const userToken = tokens.find((t) => t.integration === integration);
      return {
        id: integration,
        account: userToken?.account || "default",
        displayName: def?.displayName || integration,
        connected: connectedIntegrations.has(integration),
        email: userToken?.email || undefined,
      };
    });

    return Response.json({ integrations });
  } catch (err) {
    return errorResponse(err);
  }
}
