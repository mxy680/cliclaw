import { NextResponse, type NextRequest } from "next/server";
import { requireAuth, createOAuthState } from "@/lib/auth";
import { errorResponse, NotFoundError } from "@/lib/errors";
import { INTEGRATIONS, PROVIDERS } from "@digitalpresence/cliclaw-auth";
import { safeParam } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integration: string }> }
) {
  try {
    const user = await requireAuth();
    const { integration: rawIntegration } = await params;
    const integration = safeParam(rawIntegration, "integration");
    const account = request.nextUrl.searchParams.get("account") || "default";

    const integrationDef = INTEGRATIONS[integration];
    if (!integrationDef) throw new NotFoundError("Integration not found");

    const provider = PROVIDERS[integrationDef.provider];
    if (!provider) throw new NotFoundError("Provider not found");

    const state = createOAuthState({
      userId: user.id,
      integration,
      account,
    });

    const scopes = [
      ...provider.extraScopes,
      ...integrationDef.scopes,
    ].join(" ");

    const authParams = new URLSearchParams({
      client_id: process.env[provider.clientIdEnv]!,
      redirect_uri: `${process.env.BASE_URL}/api/integrations/callback`,
      response_type: "code",
      scope: scopes,
      state,
      ...provider.extraAuthParams,
    });

    return NextResponse.redirect(`${provider.authUrl}?${authParams}`);
  } catch (err) {
    return errorResponse(err);
  }
}
