import { NextResponse } from "next/server";

import { canAccessRoute } from "@/lib/rbac";

export const SESSION_COOKIE_NAME = "pb_demo_role";
export const STAFF_SESSION_COOKIE_NAME = "pb_staff_role";
const USER_NAME_COOKIE_NAME = "pb_user_name";

export function handleRouteAccess(request) {
  const { pathname } = request.nextUrl;

  // Resolve customer session cookies
  const customerRole = request.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  const customerName = request.cookies.get(USER_NAME_COOKIE_NAME)?.value || "";
  const isCustomerAuthenticated = customerRole === "customer";
  const isCustomerFullyOnboarded = isCustomerAuthenticated && !!customerName;

  // Resolve staff session cookies
  const staffRole = request.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value || "";
  const isStaffAuthenticated = !!staffRole && staffRole !== "customer";

  // 1. Customer Login Page Guard
  if (pathname === "/login") {
    if (isCustomerAuthenticated) {
      if (isCustomerFullyOnboarded) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } else {
        // Partially onboarded customer must go complete onboarding
        const onboardingUrl = new URL("/onboarding", request.url);
        const nextParam = request.nextUrl.searchParams.get("next");
        if (nextParam) {
          onboardingUrl.searchParams.set("next", nextParam);
        }
        return NextResponse.redirect(onboardingUrl);
      }
    }
    return NextResponse.next();
  }

  // 2. Customer Onboarding Page Guard
  if (pathname === "/onboarding") {
    if (isCustomerFullyOnboarded) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (isCustomerAuthenticated && !customerName) {
      return NextResponse.next();
    }
    // Unauthenticated user trying to access onboarding goes to customer login
    const loginUrl = new URL("/login", request.url);
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam) {
      loginUrl.searchParams.set("next", nextParam);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. Staff Login Page Guard
  if (pathname === "/staff-login") {
    if (isStaffAuthenticated) {
      const nextParam = request.nextUrl.searchParams.get("next") || "/admin";
      return NextResponse.redirect(new URL(nextParam, request.url));
    }
    return NextResponse.next();
  }

  // 4. Protected Customer Dashboard Route Guard
  if (pathname.startsWith("/dashboard")) {
    if (!isCustomerAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!customerName) {
      const onboardingUrl = new URL("/onboarding", request.url);
      onboardingUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(onboardingUrl);
    }

    if (!canAccessRoute(pathname, customerRole)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // 5. Protected Staff Admin Route Guard
  if (pathname.startsWith("/admin")) {
    if (!isStaffAuthenticated) {
      const staffLoginUrl = new URL("/staff-login", request.url);
      staffLoginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(staffLoginUrl);
    }

    if (!canAccessRoute(pathname, staffRole)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}
