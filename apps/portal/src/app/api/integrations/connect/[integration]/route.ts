import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, createOAuthState } from "@/lib/auth";
import { GOOGLE_AUTH_URL } from "@/lib/constants";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { INTEGRATIONS } from "@cliclaw/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integration: string }> }
) {
  try {
    const user = await requireAuth();
    const { integration } = await params;

    const integrationDef = INTEGRATIONS[integration];
    if (!integrationDef) throw new NotFoundError("Integration not found");

    const state = createOAuthState({
      userId: user.id,
      integration,
    });

    const scopes = [
      "openid",
      "email",
      "profile",
      ...integrationDef.scopes,
    ].join(" ");

    const authParams = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.BASE_URL}/api/integrations/callback`,
      response_type: "code",
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${authParams}`);
  } catch (err) {
    return errorResponse(err);
  }
}
