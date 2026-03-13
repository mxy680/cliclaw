import { agentFetch } from "@/lib/agent-api";

export async function POST(request: Request) {
  const body = await request.json();

  const res = await agentFetch("/auth/magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
