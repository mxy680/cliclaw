import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { streamChat } from "@/lib/chat-service";
import { injectClientTokens, persistRefreshedTokens } from "@/lib/token-injector";
import { getAgentStore } from "@/lib/agents";
import { getInstanceStore } from "@/lib/instances";
import { chatMessageSchema, parseBody, safeParam } from "@/lib/validation";
import { applyRateLimit, CHAT_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentName: string }> }
) {
  const rl = applyRateLimit(request, CHAT_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const user = await requireAuth();
    const { agentName: rawAgentName } = await params;
    const agentName = safeParam(rawAgentName, "agentName");
    const { message, sessionId } = await parseBody(request, chatMessageSchema);

    // Check access
    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    // Load agent
    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");

    // Get/create instance workspace
    const instanceStore = getInstanceStore();
    if (!existsSync(instanceStore.getInstancePath(agentName, user.id))) {
      instanceStore.createInstance(agentName, user.id);
    }
    const workspacePath = instanceStore.getWorkspacePath(agentName, user.id);

    // Inject tokens
    const ENV_ALLOWLIST = [
      "HOME", "PATH", "USER", "SHELL", "TERM",
      "NODE_ENV", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN",
    ];
    const env: Record<string, string> = {};
    for (const key of ENV_ALLOWLIST) {
      if (process.env[key]) env[key] = process.env[key]!;
    }
    const injection = injectClientTokens(user.id, agent, workspacePath, env);

    // Append connected account names so the agent uses the right --account flag
    let augmentedMessage = message;
    if (injection.connectedIntegrations.length > 0) {
      const accounts = injection.connectedIntegrations
        .map((key) => `${key.split(":")[0]}: --account ${key}`)
        .join(", ");
      augmentedMessage = `${message} [Use these accounts: ${accounts}]`;
    }

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
          const instancePath = instanceStore.getInstancePath(agentName, user.id);
          for await (const sseEvent of streamChat({
            message: augmentedMessage,
            instancePath,
            workspacePath,
            sessionId,
            env,
            signal: request.signal,
          })) {
            if (request.signal.aborted) break;
            send(sseEvent.event, sseEvent.data);
          }
        } catch (streamErr) {
          console.error("[chat] Stream error:", streamErr);
          send("error", streamErr instanceof Error ? streamErr.message : "Internal stream error");
        } finally {
          try { persistRefreshedTokens(user.id, injection); } catch {}
          try { unlinkSync(injection.tokensPath); } catch {}
          try { unlinkSync(join(workspacePath, "CLIENT_INTEGRATIONS.md")); } catch {}
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...rl.headers,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
