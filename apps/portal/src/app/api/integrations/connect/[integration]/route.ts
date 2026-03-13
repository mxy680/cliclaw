import { cookies } from "next/headers";
import { agentFetch } from "@/lib/agent-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ integration: string }> },
) {
  const { integration } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const res = await agentFetch(`/integrations/connect/${integration}`, {
      sessionToken: session,
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Failed to get connect URL" }, { status: 500 });
  }
}
