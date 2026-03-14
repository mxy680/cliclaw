import { NextResponse, type NextRequest } from "next/server";
import { verifyOAuthState } from "@/lib/auth";
import { GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL } from "@/lib/constants";
import { getStmts } from "@/lib/db-statements";
import { generateId } from "@/lib/db";
import { BadRequestError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) throw new BadRequestError("Missing code");

    const payload = state ? verifyOAuthState(state) : null;
    if (!payload || !payload.userId || !payload.integration) {
      throw new BadRequestError("Invalid or expired state");
    }
    const account = payload.account || "default";

    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.BASE_URL}/api/integrations/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, errBody);
      throw new BadRequestError("Failed to exchange code");
    }

    const tokens = await tokenRes.json();

    // Get user email for this integration
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = userRes.ok ? await userRes.json() : null;
    const email = userInfo?.email || null;

    // Upsert token
    getStmts().upsertClientToken.run(
      generateId(),
      payload.userId,
      payload.integration,
      account,
      JSON.stringify(tokens),
      email
    );

    return NextResponse.redirect(
      new URL(
        `/integrations?connected=${payload.integration}&account=${account}`,
        process.env.BASE_URL || request.url
      )
    );
  } catch (err) {
    if (err instanceof BadRequestError) {
      return NextResponse.redirect(
        new URL(
          `/integrations?error=${encodeURIComponent(err.message)}`,
          process.env.BASE_URL || request.url
        )
      );
    }
    return errorResponse(err);
  }
}
