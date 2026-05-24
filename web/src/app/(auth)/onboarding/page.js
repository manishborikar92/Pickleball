import { getPageMetadata } from "@/config/metadata";
import { CustomerOnboardingForm } from "@/components/features/auth";

export const metadata = getPageMetadata({
  title: "Complete Your Profile",
  description: "Finish setting up your Baseline Arena account to start booking pickleball courts.",
  path: "/onboarding",
  isPrivate: true,
});

export default function OnboardingPage() {
  return (
    <CustomerOnboardingForm />
  );
}
