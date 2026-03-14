import { getSession, isAdmin } from "@/lib/auth";
import { errorResponse, UnauthorizedError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) throw new UnauthorizedError();

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        isAdmin: isAdmin(user.email),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
