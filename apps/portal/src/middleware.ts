import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "cliclaw_session"; // Hardcoded — avoid importing Node.js deps into Edge

const PUBLIC_PATHS = ["/", "/auth", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (isPublicPath(pathname)) {
    if (hasSession && pathname === "/") {
      return NextResponse.redirect(new URL("/agents", request.url));
    }
    return NextResponse.next();
  }

  // Protected API routes: return 401 JSON
  if (!hasSession && pathname.startsWith("/api/")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protected pages: redirect to sign-in
  if (!hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
