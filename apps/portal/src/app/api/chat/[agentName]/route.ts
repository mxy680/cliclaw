import { cookies } from "next/headers";
import { agentFetch } from "@/lib/agent-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentName: string }> },
) {
  const { agentName } = await params;

  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();

  const agentRes = await agentFetch(`/chat/${agentName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    sessionToken: session,
  });

  if (!agentRes.ok || !agentRes.body) {
    const status = agentRes.status;
    const data = await agentRes.json().catch(() => ({ error: "Agent server error" }));
    return new Response(JSON.stringify(data), {
      status: status >= 400 ? status : 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(agentRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
