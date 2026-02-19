import { NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/login";
const HOME_AFTER_LOGIN = "/traces";
const AUTH_COOKIE = "auth_user";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.cookies.get(AUTH_COOKIE)?.value);

  if (pathname === LOGIN_PATH) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(HOME_AFTER_LOGIN, req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

