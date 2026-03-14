import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ integration: string }> }
) {
  try {
    const user = await requireAuth();
    const { integration } = await params;

    if (!INTEGRATIONS[integration]) {
      throw new NotFoundError("Integration not found");
    }

    getStmts().deleteClientToken.run(user.id, integration);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
