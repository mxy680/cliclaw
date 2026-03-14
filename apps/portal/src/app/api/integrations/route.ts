import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse } from "@/lib/errors";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import type { ClientTokenRow } from "@/lib/types";

export async function GET() {
  try {
    const user = await requireAuth();

    const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];

    // Group tokens by integration
    const tokensByIntegration = new Map<
      string,
      Array<{ account: string; email?: string }>
    >();
    for (const t of tokens) {
      const list = tokensByIntegration.get(t.integration) || [];
      list.push({ account: t.account, email: t.email || undefined });
      tokensByIntegration.set(t.integration, list);
    }

    const integrations = Object.values(INTEGRATIONS).map((i) => {
      const accounts = tokensByIntegration.get(i.id) || [];
      return {
        id: i.id,
        displayName: i.displayName,
        connected: accounts.length > 0,
        email: accounts[0]?.email,
        accounts,
      };
    });

    return Response.json({ integrations });
  } catch (err) {
    return errorResponse(err);
  }
}
