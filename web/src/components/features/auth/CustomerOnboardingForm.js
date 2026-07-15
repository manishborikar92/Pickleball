"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, FormAlert } from "@/components/shared";
import { completeOnboardingAction } from "@/lib/actions/auth";
import { safeNext } from "@/lib/safeNext";
import { NameForm } from "./steps/NameForm";

/**
 * CustomerOnboardingForm — Profile registration using server actions directly.
 */
export function CustomerOnboardingForm({ onSuccess, inline = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleNameSubmit(fullName) {
    setLoading(true);
    setError("");

    try {
      const res = await completeOnboardingAction(fullName);
      if (!res.ok) throw new Error(res.error.message);

      if (onSuccess) {
        onSuccess({ name: fullName });
      } else {
        const next = safeNext(searchParams.get("next"), "/dashboard/overview");
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
