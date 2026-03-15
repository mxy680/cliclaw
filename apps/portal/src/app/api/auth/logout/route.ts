import { getSessionToken } from "@/lib/session";
import { getStmts } from "@/lib/db-statements";
import { SESSION_COOKIE } from "@/lib/constants";
import { errorResponse } from "@/lib/errors";
import { cookies } from "next/headers";
import { applyRateLimit, AUTH_LIMIT } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rl = applyRateLimit(request, AUTH_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const token = await getSessionToken();
    if (token) {
      await getStmts().deleteSession.run(token);
    }

    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);

    return Response.json({ ok: true }, { headers: rl.headers });
  } catch (err) {
    return errorResponse(err);
  }
}
