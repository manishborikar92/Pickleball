import { PricingManager } from "@/components/features/admin/AdminViews";
import { requireRouteAccess } from "@/lib/session";

export default async function PricingPage() {
  await requireRouteAccess("/admin/pricing");
  return <PricingManager />;
}
