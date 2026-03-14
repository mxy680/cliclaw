import { spawn } from "child_process";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const { agentName, jobId } = await request.json();

    // Verify access
    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    // Verify job exists
    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");
    const job = agent.cronJobs.find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Job not found");

    // Run in background via cliclaw CLI
    const child = spawn("cliclaw", ["cron", "run", agentName, jobId], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
      },
      detached: true,
    });

    // Don't wait for completion — it runs in the background
    child.unref();

    // Collect initial output briefly to check for immediate errors
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Wait a moment for immediate failures
    const immediateError = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 2000);
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve(err.message);
      });
      child.on("exit", (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timer);
          resolve(stderr || `Exit code ${code}`);
        }
      });
    });

    if (immediateError) {
      return Response.json({ error: immediateError }, { status: 500 });
    }

    return Response.json({
      status: "started",
      agentName,
      jobId,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
