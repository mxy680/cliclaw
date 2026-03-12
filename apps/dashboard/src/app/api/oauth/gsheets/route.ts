import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuth } from "@/lib/auth";
import { getGSheetsAuthUrl } from "@cliclaw/auth";

export async function GET(request: NextRequest) {
  const account = request.nextUrl.searchParams.get("account");
  if (!account) {
    return NextResponse.json({ error: "Missing account parameter" }, { status: 400 });
  }

  const clientManager = getDashboardAuth();
  const client = clientManager.getRawClient();
  const url = getGSheetsAuthUrl(client);

  const response = NextResponse.redirect(url);
  response.cookies.set("oauth_account", `gsheets:${account}`, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
  });

  return response;
}
