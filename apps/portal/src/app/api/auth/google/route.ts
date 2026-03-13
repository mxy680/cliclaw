import { redirect } from "next/navigation";
import { agentFetch } from "@/lib/agent-api";

export async function GET() {
  const res = await agentFetch("/auth/google/url");

  if (!res.ok) {
    redirect("/?error=server_error");
  }

  const { url } = await res.json() as { url: string };
  redirect(url);
}
