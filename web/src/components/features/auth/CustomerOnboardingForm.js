"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { NameForm } from "./steps/NameForm";
import { AlertCircle } from "lucide-react";

/**
 * CustomerOnboardingForm — Profile registration using shared step and AuthContext.
 */
export function CustomerOnboardingForm({ phone: phoneProp, onSuccess, inline = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOnboarding } = useAuth();
  
  const [phone, setPhone] = useState(phoneProp || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!phoneProp) {
      const resolved = authService.resolvePendingPhone();
      setPhone(resolved);
    }
  }, [phoneProp]);

  async function handleNameSubmit(fullName) {
    setLoading(true);
    setError("");

    setTimeout(async () => {
      try {
        // Complete onboarding via context action
        await completeOnboarding(fullName, phone);

        if (onSuccess) {
          onSuccess({ name: fullName, phone });
        } else {
          const next = searchParams.get("next") || "/dashboard";
          router.push(next);
          router.refresh();
        }
      } catch (err) {
        setError("Failed to save profile. Please try again.");
        setLoading(false);
      }
    }, 400);
  }

  const errorBanner = error && (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <p>{error}</p>
    </div>
  );

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
