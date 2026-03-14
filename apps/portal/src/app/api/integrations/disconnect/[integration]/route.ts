import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import { renameAccountSchema, parseBody, safeParam } from "@/lib/validation";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ integration: string }> }
) {
  try {
    const user = await requireAuth();
    const { integration: rawIntegration } = await params;
    const integration = safeParam(rawIntegration, "integration");
    const account = request.nextUrl.searchParams.get("account") || "default";

    if (!INTEGRATIONS[integration]) {
      throw new NotFoundError("Integration not found");
    }

    getStmts().deleteClientToken.run(user.id, integration, account);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ integration: string }> }
) {
  try {
    const user = await requireAuth();
    const { integration: rawIntegration } = await params;
    const integration = safeParam(rawIntegration, "integration");

    if (!INTEGRATIONS[integration]) {
      throw new NotFoundError("Integration not found");
    }

    const { account, newName } = await parseBody(request, renameAccountSchema);

    const result = getStmts().renameClientTokenAccount.run(
      newName,
      user.id,
      integration,
      account
    );

    if (result.changes === 0) {
      throw new NotFoundError("Account not found");
    }

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
