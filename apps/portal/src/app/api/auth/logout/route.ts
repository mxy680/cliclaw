import { cookies } from "next/headers";
import { agentFetch } from "@/lib/agent-api";

export async function POST() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (session) {
    await agentFetch("/auth/logout", {
      method: "POST",
      sessionToken: session,
    });
  }

  cookieStore.delete("session");

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
