import { handleRouteAccess } from "@/lib/proxy-core";

export async function proxy(request) {
  return await handleRouteAccess(request);
}

export const config = {
  matcher: ["/login", "/onboarding", "/staff-login", "/dashboard/:path*", "/admin/:path*"],
};
