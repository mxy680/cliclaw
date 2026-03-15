import { requireAuth } from "@/lib/auth";
import { getSessionManager, type InputPayload } from "@/lib/browser-session-manager";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ integration: string }> }
) {
  const user = await requireAuth();
  const { integration } = await params;

  const body = await request.json();
  const { sessionId, ...event } = body as { sessionId: string } & InputPayload;

  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const manager = getSessionManager();
  const session = manager.getSession(sessionId);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.userId !== user.id || session.integration !== integration) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await manager.dispatchInput(sessionId, event);
  return Response.json({ ok: true });
}
