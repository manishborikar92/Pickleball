import { Suspense } from "react";
import { getPageMetadata } from "@/config/metadata";
import { StaffLoginForm } from "@/components/features/auth";
import { Loader } from "@/components/shared";

export const metadata = getPageMetadata({
  title: "Staff Sign In",
  description: "Sign in to Baseline Arena administrative portal.",
  path: "/staff-login",
  isPrivate: true,
});

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<Loader variant="spinner" className="py-20" />}>
      <StaffLoginForm />
    </Suspense>
  );
}
