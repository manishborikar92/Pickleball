"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, FormAlert } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { NameForm } from "./steps/NameForm";

/**
 * CustomerOnboardingForm — Profile registration using shared step and AuthContext.
 */
export function CustomerOnboardingForm({ phone: phoneProp, onSuccess, inline = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOnboarding } = useAuth();
  
  const [phone] = useState(() => {
    return phoneProp || authService.resolvePendingPhone() || "";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleNameSubmit(fullName) {
    setLoading(true);
    setError("");

    try {
      await completeOnboarding(fullName, phone);

      if (onSuccess) {
        onSuccess({ name: fullName, phone });
      } else {
        const nextParam = searchParams.get("next");
        const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard/overview";
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError("Failed to save profile. Please try again.");
      setLoading(false);
    }
  }

  const errorBanner = <FormAlert type="error" message={error} />;

  const content = (
    <div className="space-y-6">
      <NameForm
        onSubmit={handleNameSubmit}
        loading={loading}
      />
      {errorBanner}
    </div>
  );

  if (inline) return content;
  return <Card className="p-8">{content}</Card>;
}
