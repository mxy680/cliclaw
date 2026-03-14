import { NextResponse, type NextRequest } from "next/server";
import { PROVIDERS } from "@digitalpresence/cliclaw-auth";
import { verifyOAuthState, findOrCreateUser, createSession } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session";
import { BadRequestError, errorResponse } from "@/lib/errors";
import { applyRateLimit, AUTH_LIMIT } from "@/lib/rate-limit";

const google = PROVIDERS.google;

export async function GET(request: NextRequest) {
  const rl = applyRateLimit(request, AUTH_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) throw new BadRequestError("Missing code parameter");
    if (!state || !verifyOAuthState(state)) {
      throw new BadRequestError("Invalid or expired state");
    }

    // Exchange code for tokens
    const tokenRes = await fetch(google.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.BASE_URL}/api/auth/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new BadRequestError("Failed to exchange authorization code");
    }

    const tokens = await tokenRes.json();

    // Fetch user info
    const userRes = await fetch(google.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      throw new BadRequestError("Failed to fetch user info");
    }

    const userInfo = await userRes.json();
    const user = findOrCreateUser(userInfo.email);
    const sessionToken = createSession(user.id);

    const baseUrl = process.env.BASE_URL || request.url;
    const response = NextResponse.redirect(new URL("/agents", baseUrl));
    response.cookies.set(sessionCookieOptions(sessionToken));
    return response;
  } catch (err) {
    if (err instanceof BadRequestError) {
      const base = process.env.BASE_URL || request.url;
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(err.message)}`, base)
      );
    }
    return errorResponse(err);
  }
}
