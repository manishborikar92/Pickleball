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
    <main className="sm:mx-auto sm:w-full sm:max-w-md px-6">
      <CustomerLoginForm
        showStaffLink={true}
      />
    </main>
  );
}
