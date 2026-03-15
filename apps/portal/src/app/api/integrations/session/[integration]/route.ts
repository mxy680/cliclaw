import { requireAuth } from "@/lib/auth";
import { getSessionManager } from "@/lib/browser-session-manager";
import { INTEGRATIONS } from "@digitalpresence/cliclaw-auth";
import { getStmts } from "@/lib/db-statements";
import { generateId } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST: Create a new browser session
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ integration: string }> }
) {
  const user = await requireAuth();
  const { integration } = await params;

  const def = INTEGRATIONS[integration];
  if (!def || def.authType !== "session") {
    return Response.json(
      { error: `Invalid session integration: ${integration}` },
      { status: 400 }
    );
  }

  try {
    const manager = getSessionManager();
    const sessionId = await manager.createSession(user.id, integration);
    return Response.json({ sessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    return Response.json({ error: message }, { status: 500 });
  }
}

// GET: SSE stream of browser frames
export async function GET(
  request: Request,
  { params }: { params: Promise<{ integration: string }> }
) {
  const user = await requireAuth();
  const { integration } = await params;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 });
  }

  const manager = getSessionManager();
  const session = manager.getSession(sessionId);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Verify the session belongs to this user
  if (session.userId !== user.id || session.integration !== integration) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: string) {
        const lines = data
          .split("\n")
          .map((l) => `data: ${l}`)
          .join("\n");
        controller.enqueue(encoder.encode(`event: ${event}\n${lines}\n\n`));
      }

      const unsubscribe = manager.subscribe(sessionId, (event) => {
        try {
          switch (event.type) {
            case "frame":
              // Send raw base64 data — client prepends data:image/jpeg;base64,
              send("frame", event.data);
              break;
            case "metadata":
              send("metadata", JSON.stringify({ width: event.width, height: event.height }));
              break;
            case "connected": {
              // Store the session cookies as an integration token
              const account = "default";
              const credentials = JSON.stringify({
                access_token: event.cookies.sessionid || "",
                ...event.cookies,
                connected_at: new Date().toISOString(),
              });

              getStmts().upsertClientToken.run(
                generateId(),
                user.id,
                integration,
                account,
                credentials,
                event.username ? `@${event.username}` : null
              );

              send("connected", JSON.stringify({ username: event.username }));
              break;
            }
            case "error":
              send("error", JSON.stringify({ message: event.message }));
              break;
            case "closed":
              send("closed", "{}");
              controller.close();
              break;
          }
        } catch {
          // Controller may be closed
        }
      });

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
