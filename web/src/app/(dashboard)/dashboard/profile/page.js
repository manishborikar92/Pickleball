import { ProfileForm } from "@/components/features/auth";
import { SectionHeader } from "@/components/shared";
import { requireRouteAccess } from "@/lib/dal/session";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const session = await requireRouteAccess("/dashboard/profile");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto pb-2 sm:gap-10">
      <SectionHeader align="left" eyebrow="Account" title="Profile">
        Manage the name associated with your pickleball bookings and venue communications.
      </SectionHeader>
      <ProfileForm initialName={session.user.name} phone={session.user.phone} />
    </div>
  );
}
