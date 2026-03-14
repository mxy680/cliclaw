import { GOOGLE_AUTH_URL } from "@/lib/constants";
import { createOAuthState } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export async function GET() {
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

    return Response.json({ url: `${GOOGLE_AUTH_URL}?${params}` });
  } catch (err) {
    return errorResponse(err);
  }
}
