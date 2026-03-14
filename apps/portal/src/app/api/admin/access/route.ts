import { requireAdmin, findOrCreateUser } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { generateId } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { getInstanceStore } from "@/lib/instances";
import { accessGrantSchema, accessRevokeSchema, parseBody } from "@/lib/validation";
import { applyRateLimit, API_LIMIT } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rl = applyRateLimit(request, API_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    await requireAdmin();
    const access = getStmts().listAccess.all();
    return Response.json({ access });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  const rl = applyRateLimit(request, API_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const admin = await requireAdmin();
    const { email, agentName } = await parseBody(request, accessGrantSchema);

    const user = findOrCreateUser(email);
    const id = generateId();
    getStmts().grantAccess.run(id, user.id, agentName, admin.id);

    // Create instance for this user
    try {
      getInstanceStore().createInstance(agentName, user.id);
    } catch {
      // Instance creation is best-effort — will be created on first chat if needed
    }

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  const rl = applyRateLimit(request, API_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    await requireAdmin();
    const { userId, agentName } = await parseBody(request, accessRevokeSchema);

    getStmts().revokeAccess.run(userId, agentName);

    // Delete instance
    try {
      getInstanceStore().deleteInstance(agentName, userId);
    } catch {
      // Best-effort cleanup
    }

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
