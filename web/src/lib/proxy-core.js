import { NextResponse } from "next/server";

import { canAccessRoute } from "@/lib/rbac";

export const SESSION_COOKIE_NAME = "pb_demo_role";

const protectedPrefixes = ["/dashboard", "/admin"];

export function handleRouteAccess(request) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  const role = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!role) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessRoute(pathname, role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}
