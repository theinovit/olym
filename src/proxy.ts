import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (verifySessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") {
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api/auth(?:/|$)|login(?:/|$)|_next/static|_next/image|.*\\..*).*)",
  ],
};
