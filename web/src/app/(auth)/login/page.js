import { getPageMetadata } from "@/config/metadata";
import { CustomerLoginForm } from "@/components/features/auth";

export const metadata = getPageMetadata({
  title: "Sign In",
  description: "Sign in to Baseline Arena to manage your pickleball court bookings, view transactions, and redeem rewards.",
  path: "/login",
  isPrivate: true,
});

export default function LoginPage() {
  return (
    <CustomerLoginForm showStaffLink={true} />
  );
}
