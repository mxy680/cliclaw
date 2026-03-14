import { PROVIDERS } from "@digitalpresence/cliclaw-auth";
import { createOAuthState } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { applyRateLimit, AUTH_LIMIT } from "@/lib/rate-limit";

const google = PROVIDERS.google;

export async function GET(request: Request) {
  const rl = applyRateLimit(request, AUTH_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const state = createOAuthState({});
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.BASE_URL}/api/auth/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return Response.json(
      { url: `${google.authUrl}?${params}` },
      { headers: rl.headers }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
