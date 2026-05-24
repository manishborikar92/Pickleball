import { handleRouteAccess } from "@/lib/proxy-core";

export function proxy(request) {
  return handleRouteAccess(request);
}

export const config = {
  matcher: ["/login", "/onboarding", "/staff-login", "/dashboard/:path*", "/admin/:path*"],
};
