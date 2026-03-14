import { getSession, isAdmin } from "@/lib/auth";
import { errorResponse, UnauthorizedError } from "@/lib/errors";
import { applyRateLimit, AUTH_LIMIT } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rl = applyRateLimit(request, AUTH_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const user = await getSession();
    if (!user) throw new UnauthorizedError();

    return Response.json(
      {
        user: {
          id: user.id,
          email: user.email,
          isAdmin: isAdmin(user.email),
        },
      },
      { headers: rl.headers }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
