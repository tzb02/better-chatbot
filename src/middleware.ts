import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log("[DEBUG] Middleware called for path:", pathname);

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    console.log("[DEBUG] Middleware ping request");
    return new Response("pong", { status: 200 });
  }

  if (pathname === "/admin") {
    console.log("[DEBUG] Middleware redirecting /admin to /admin/users");
    return NextResponse.redirect(new URL("/admin/users", request.url));
  }

  // Allow sign-up flow to continue without session cookie
  if (pathname.startsWith("/sign-up") || pathname === "/" || pathname.startsWith("/api/stripe")) {
    console.log("[DEBUG] Middleware allowing sign-up flow to continue for path:", pathname);
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  console.log("[DEBUG] Middleware session cookie present:", !!sessionCookie);

  if (!sessionCookie) {
    console.log("[DEBUG] Middleware redirecting to sign-in for path:", pathname);
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  console.log("[DEBUG] Middleware allowing request to continue for path:", pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/auth|export|sign-in|sign-up).*)",
  ],
};
