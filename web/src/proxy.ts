import { NextResponse } from "next/server";
import { auth } from "@/auth";

// `auth` alone only attaches session info to the request — it does NOT
// block unauthenticated requests by itself. This dashboard must never be
// publicly reachable, so redirect to sign-in explicitly when there's no
// session.
export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
