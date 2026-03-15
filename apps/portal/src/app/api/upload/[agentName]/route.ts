import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { join, basename } from "path";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError, BadRequestError } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";
import { getInstanceStore } from "@/lib/instances";
import { sanitizeFilename, safeParam } from "@/lib/validation";
import { applyRateLimit, UPLOAD_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentName: string }> }
) {
  const rl = applyRateLimit(request, UPLOAD_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const user = await requireAuth();
    const { agentName: rawAgentName } = await params;
    const agentName = safeParam(rawAgentName, "agentName");

    const hasAccess = await getStmts().checkAccess.get(user.id, agentName);
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
      // Sanitize the filename: strip path separators, reject null bytes and leading dots
      const safeName = sanitizeFilename(basename(file.name));

      // Verify the resolved path stays within the uploads directory
      const filePath = join(uploadsDir, safeName);
      if (!filePath.startsWith(uploadsDir + "/") && filePath !== uploadsDir) {
        throw new BadRequestError("Invalid filename: path traversal detected");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      await writeFile(filePath, bytes);
      uploaded.push(safeName);
    }

    return Response.json({ uploaded });
  } catch (err) {
    return errorResponse(err);
  }
}
