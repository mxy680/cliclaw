import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { agentFetch } from "@/lib/agent-api";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${origin}/chat?error=integration_denied`);
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) {
    return NextResponse.redirect(`${origin}/?error=not_authenticated`);
  }

  try {
    const res = await agentFetch("/integrations/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
      sessionToken: session,
    });

    if (!res.ok) {
      return NextResponse.redirect(`${origin}/chat?error=integration_failed`);
    }

    const data = (await res.json()) as { integration: string };

    return NextResponse.redirect(
      `${origin}/integrations?connected=${data.integration}`,
    );
  } catch {
    return NextResponse.redirect(`${origin}/chat?error=server_error`);
  }
}
