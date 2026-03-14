import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";
import { getInstanceStore } from "@/lib/instances";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentName: string }> }
) {
  try {
    const user = await requireAuth();
    const { agentName } = await params;

    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");

    const instanceStore = getInstanceStore();
    if (!existsSync(instanceStore.getInstancePath(agentName, user.id))) {
      instanceStore.createInstance(agentName, user.id);
    }
    const workspacePath = instanceStore.getWorkspacePath(agentName, user.id);

    // Ensure uploads directory exists
    const uploadsDir = join(workspacePath, "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    const uploaded: string[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const filePath = join(uploadsDir, file.name);
      await writeFile(filePath, bytes);
      uploaded.push(file.name);
    }

    return Response.json({ uploaded });
  } catch (err) {
    return errorResponse(err);
  }
}
