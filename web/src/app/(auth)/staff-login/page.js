import { getPageMetadata } from "@/config/metadata";
import { StaffLoginForm } from "@/components/features/auth";

export const metadata = getPageMetadata({
  title: "Staff Sign In",
  description: "Sign in to Baseline Arena administrative portal.",
  path: "/staff-login",
  isPrivate: true,
});

export default function StaffLoginPage() {
  return (
    <main className="sm:mx-auto sm:w-full sm:max-w-md px-6">
      <StaffLoginForm />
    </main>
  );
}
