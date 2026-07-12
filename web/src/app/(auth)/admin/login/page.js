import { Suspense } from "react";
import { getPageMetadata } from "@/config/metadata.config";
import { AdminLoginForm } from "@/components/features/auth";
import { Loader } from "@/components/shared";

export const metadata = getPageMetadata({
  title: "Admin Sign In",
  description: "Sign in to Baseline Arena administrative portal.",
  path: "/admin/login",
  isPrivate: true,
});

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<Loader variant="spinner" className="py-20" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
