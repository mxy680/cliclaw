import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { streamChat } from "@/lib/chat-service";
import { injectClientTokens, persistRefreshedTokens } from "@/lib/token-injector";
import { getAgentStore } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentName: string }> }
) {
  try {
    const user = await requireAuth();
    const { agentName } = await params;
    const { message, sessionId } = await request.json();

    // Check access
    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    // Load agent
    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");

    // Get/create workspace
    const workspacePath = getAgentStore().clientWorkspacePath(agentName, user.id);

    // Inject tokens
    const env: Record<string, string> = { ...process.env as any };
    const injection = injectClientTokens(user.id, agent, workspacePath, env);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(event: string, data: string) {
          const encoded = data
            .split("\n")
            .map((l) => `data: ${l}`)
            .join("\n");
          controller.enqueue(
            encoder.encode(`event: ${event}\n${encoded}\n\n`)
          );
        }

        try {
          for await (const sseEvent of streamChat({
            message,
            workspacePath,
            sessionId,
            env,
            signal: request.signal,
          })) {
            if (request.signal.aborted) break;
            send(sseEvent.event, sseEvent.data);
          }
        } finally {
          persistRefreshedTokens(user.id, injection);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
