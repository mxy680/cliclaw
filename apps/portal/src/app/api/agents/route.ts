import { createClient } from "@/lib/supabase/server";
import { agentFetch } from "@/lib/agent-api";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: access } = await supabase
    .from("client_agent_access")
    .select("agent_name")
    .eq("user_id", user.id);

  const agentNames = new Set((access ?? []).map((a: { agent_name: string }) => a.agent_name));

  try {
    const res = await agentFetch("/agents");
    if (!res.ok) throw new Error("Agent server error");
    const data = await res.json();
    const agents = (data.agents as { name: string }[]).filter((a) => agentNames.has(a.name));
    return Response.json({ agents });
  } catch {
    return Response.json({ agents: [] });
  }
}
