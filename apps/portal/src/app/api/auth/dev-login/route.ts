import { NextResponse } from "next/server";
import { findOrCreateUser, createSession } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session";

const DEV_EMAIL = "dev@localhost";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not available" }, { status: 404 });
  }

  const user = findOrCreateUser(DEV_EMAIL);
  const token = createSession(user.id);

  const response = NextResponse.redirect(new URL("/agents", "http://localhost:3000"));
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
