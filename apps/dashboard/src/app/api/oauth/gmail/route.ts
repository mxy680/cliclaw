import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuth, getTokenStore } from "@/lib/auth";
import { getAuthUrl } from "@cliclaw/auth";

export async function GET(request: NextRequest) {
  const account = request.nextUrl.searchParams.get("account");
  if (!account) {
    return NextResponse.json({ error: "Missing account parameter" }, { status: 400 });
  }

  const clientManager = getDashboardAuth();
  const client = clientManager.getRawClient();
  const url = getAuthUrl(client);

  const response = NextResponse.redirect(url);
  response.cookies.set("oauth_account", account, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
  });

  return response;
}
