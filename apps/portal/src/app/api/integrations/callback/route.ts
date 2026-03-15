import { NextResponse, type NextRequest } from "next/server";
import { verifyOAuthState } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { generateId } from "@/lib/db";
import { BadRequestError, errorResponse } from "@/lib/errors";
import { INTEGRATIONS, PROVIDERS } from "@digitalpresence/cliclaw-auth";

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

    const integrationDef = INTEGRATIONS[payload.integration];
    if (!integrationDef) throw new BadRequestError("Unknown integration");

    const provider = PROVIDERS[integrationDef.provider];
    if (!provider) throw new BadRequestError("Unknown provider");

    // Exchange code for tokens
    const tokenRes = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env[provider.clientIdEnv]!,
        client_secret: process.env[provider.clientSecretEnv]!,
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

    // Compute absolute expiry so the Google auth library auto-refreshes
    if (tokens.expires_in && !tokens.expiry_date) {
      tokens.expiry_date = Date.now() + tokens.expires_in * 1000;
    }

    // Get user email for this integration
    let email: string | null = null;

    const userRes = await fetch(provider.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (userRes.ok) {
      const userInfo = await userRes.json();
      email = userInfo.email || null;

      // GitHub: email may be private; fall back to /user/emails endpoint
      if (!email && integrationDef.provider === "github") {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (emailsRes.ok) {
          const emails = await emailsRes.json();
          const primary = emails.find(
            (e: { primary: boolean; verified: boolean; email: string }) =>
              e.primary && e.verified
          );
          email = primary?.email || null;
        }
      }
    }

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
