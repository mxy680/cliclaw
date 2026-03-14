import { requireAdmin, findOrCreateUser } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { generateId } from "@/lib/db";
import { errorResponse, BadRequestError } from "@/lib/errors";

export async function GET() {
  try {
    await requireAdmin();
    const access = getStmts().listAccess.all();
    return Response.json({ access });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { email, agentName } = await request.json();

    if (!email || !agentName) {
      throw new BadRequestError("email and agentName are required");
    }

    const user = findOrCreateUser(email);
    const id = generateId();
    getStmts().grantAccess.run(id, user.id, agentName, admin.id);

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { userId, agentName } = await request.json();

    if (!userId || !agentName) {
      throw new BadRequestError("userId and agentName are required");
    }

    getStmts().revokeAccess.run(userId, agentName);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
