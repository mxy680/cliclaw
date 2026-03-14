import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, BadRequestError, NotFoundError } from "@/lib/errors";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ integration: string }> }
) {
  try {
    const user = await requireAuth();
    const { integration } = await params;
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
    const { integration } = await params;

    if (!INTEGRATIONS[integration]) {
      throw new NotFoundError("Integration not found");
    }

    const body = await request.json();
    const { account, newName } = body as { account?: string; newName?: string };

    if (!account || !newName?.trim()) {
      throw new BadRequestError("account and newName are required");
    }

    const result = getStmts().renameClientTokenAccount.run(
      newName.trim(),
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
