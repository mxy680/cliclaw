import { cookies } from "next/headers";
import { agentFetch } from "@/lib/agent-api";

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await agentFetch("/agents", { sessionToken: session });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ agents: [] });
  }
}
