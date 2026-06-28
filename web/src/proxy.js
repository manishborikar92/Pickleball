import { NextResponse } from "next/server";

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const hasToken = request.cookies.has("pb_access_token")
                || request.cookies.has("pb_refresh_token");
  const hasStaffRole = request.cookies.has("pb_staff_role");
  const isOnboarded = request.cookies.get("pb_user_onboarded")?.value === "true";
  const hasCustomerRole = request.cookies.get("pb_auth_role")?.value === "customer";

  // Redirect unauthenticated users away from protected routes
  if (pathname.startsWith("/dashboard") && !hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (pathname.startsWith("/admin") && (!hasToken || !hasStaffRole)) {
    const staffLoginUrl = new URL("/staff-login", request.url);
    staffLoginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(staffLoginUrl);
  }

  // Redirect unboarded customers to onboarding
  if (pathname.startsWith("/dashboard") && hasToken && hasCustomerRole && !isOnboarded) {
    const onboardingUrl = new URL("/onboarding", request.url);
    onboardingUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(onboardingUrl);
  }

  // Redirect authenticated users away from login pages
  if (pathname === "/login" && hasToken && isOnboarded) {
    return NextResponse.redirect(new URL("/dashboard/overview", request.url));
  }
  if (pathname === "/login" && hasToken && !isOnboarded) {
    const onboardingUrl = new URL("/onboarding", request.url);
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) onboardingUrl.searchParams.set("next", nextParam);
    return NextResponse.redirect(onboardingUrl);
  }
  if (pathname === "/onboarding" && hasToken && isOnboarded) {
    return NextResponse.redirect(new URL("/dashboard/overview", request.url));
  }
  if (pathname === "/onboarding" && !hasToken) {
    const loginUrl = new URL("/login", request.url);
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) loginUrl.searchParams.set("next", nextParam);
    return NextResponse.redirect(loginUrl);
  }
  if (pathname === "/staff-login" && hasToken && hasStaffRole) {
    const nextParam = request.nextUrl.searchParams.get("next") || "/admin/overview";
    const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin/overview";
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/onboarding", "/staff-login", "/dashboard/:path*", "/admin/:path*"],
};
