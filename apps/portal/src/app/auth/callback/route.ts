import { NextResponse } from "next/server";
import { agentFetch } from "@/lib/agent-api";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${origin}/?error=missing_token`);
  }

  try {
    const res = await agentFetch("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      return NextResponse.redirect(`${origin}/?error=invalid_token`);
    }

    const data = await res.json() as { sessionToken: string };

    const response = NextResponse.redirect(`${origin}/chat`);
    response.cookies.set("session", data.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch {
    return NextResponse.redirect(`${origin}/?error=server_error`);
  }
}
