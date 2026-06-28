import { Suspense } from "react";
import { getPageMetadata } from "@/config/metadata";
import { CustomerLoginForm } from "@/components/features/auth";
import { Loader } from "@/components/shared";

export const metadata = getPageMetadata({
  title: "Sign In",
  description: "Sign in to Baseline Arena to manage your pickleball court bookings, view transactions, and redeem rewards.",
  path: "/login",
  isPrivate: true,
});

export default function LoginPage() {
  return (
    <Suspense fallback={<Loader variant="spinner" className="py-20" />}>
      <CustomerLoginForm showAdminLink={true} />
    </Suspense>
  );
}
