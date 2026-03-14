import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse } from "@/lib/errors";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import type { ClientTokenRow } from "@/lib/types";

export async function GET() {
  try {
    const user = await requireAuth();

    const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];
    const connectedMap = new Map(tokens.map((t) => [t.integration, t.email]));

    const integrations = Object.values(INTEGRATIONS).map((i) => ({
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
