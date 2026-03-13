import { getSessionToken } from "@/lib/session";
import { getStmts } from "@/lib/db-statements";
import { SESSION_COOKIE } from "@/lib/constants";
import { errorResponse } from "@/lib/errors";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) {
      getStmts().deleteSession.run(token);
    }

    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
