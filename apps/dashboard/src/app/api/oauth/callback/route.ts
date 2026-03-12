import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const account = request.cookies.get("oauth_account")?.value;

  // Determine which integration page to redirect to
  const redirectPage = account?.startsWith("gdrive:") ? "/gdrive" : "/gmail";

  if (error) {
    return NextResponse.redirect(new URL(`${redirectPage}?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${redirectPage}?error=no_code`, request.url));
  }

  if (!account) {
    return NextResponse.redirect(new URL("/gmail?error=no_account_cookie", request.url));
  }

  try {
    const clientManager = getDashboardAuth();
    const client = clientManager.getRawClient();
    const { tokens } = await client.getToken(code);
    clientManager.setCredentials(account, tokens);

    const response = NextResponse.redirect(new URL(`${redirectPage}?success=true`, request.url));
    response.cookies.delete("oauth_account");
    return response;
  } catch {
    return NextResponse.redirect(new URL(`${redirectPage}?error=token_exchange_failed`, request.url));
  }
}
