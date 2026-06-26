import { Suspense } from "react";
import { getPageMetadata } from "@/config/metadata";
import { CustomerOnboardingForm } from "@/components/features/auth";
import { Loader } from "@/components/shared";

export const metadata = getPageMetadata({
  title: "Complete Your Profile",
  description: "Finish setting up your Baseline Arena account to start booking pickleball courts.",
  path: "/onboarding",
  isPrivate: true,
});

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Loader variant="spinner" className="py-20" />}>
      <CustomerOnboardingForm />
    </Suspense>
  );
}
