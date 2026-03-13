import { createClient } from "@/lib/supabase/server";
import { agentFetch } from "@/lib/agent-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentName: string }> },
) {
  const { agentName } = await params;

  // Verify auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check access
  const { data: access } = await supabase
    .from("client_agent_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("agent_name", agentName)
    .single();

  if (!access) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Forward to agent server
  const body = await request.json();

  const agentRes = await agentFetch(`/chat/${agentName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!agentRes.ok || !agentRes.body) {
    return new Response(JSON.stringify({ error: "Agent server error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream the SSE response through
  return new Response(agentRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
