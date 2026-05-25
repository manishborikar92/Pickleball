"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, FormAlert } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { PhoneForm } from "./steps/PhoneForm";
import { OtpForm } from "./steps/OtpForm";

/**
 * CustomerLoginForm — Phone + OTP authentication using shared steps and AuthContext.
 */
export function CustomerLoginForm({ onSuccess, showStaffLink = false, inline = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginCustomer } = useAuth();
  
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePhoneSubmit(verifiedPhone) {
    setLoading(true);
    setError("");
    setTimeout(() => {
      setPhone(verifiedPhone);
      setStep("otp");
      setLoading(false);
    }, 400);
  }

  async function handleOtpSubmit(otpCode) {
    setLoading(true);
    setError("");

    setTimeout(async () => {
      try {
        const existingName = authService.getRegisteredName(phone) || "";

        // Invoke unified customer log-in
        const result = await loginCustomer(phone, existingName);

        if (onSuccess) {
          onSuccess({ phone, isNew: !existingName });
        } else {
          const next = searchParams.get("next") || "/dashboard";
          if (!existingName) {
            router.push(`/onboarding?next=${encodeURIComponent(next)}`);
          } else {
            router.push(next);
          }
          router.refresh();
        }
      } catch (err) {
        setError("Failed to create customer session. Please try again.");
        setLoading(false);
      }
    }, 400);
  }

  const errorBanner = <FormAlert type="error" message={error} />;

  const content = (
    <div className="space-y-6">
      {step === "phone" && (
        <PhoneForm
          initialPhone={phone}
          onSubmit={handlePhoneSubmit}
          loading={loading}
        />
      )}

      {step === "otp" && (
        <OtpForm
          phone={phone}
          onSubmit={handleOtpSubmit}
          loading={loading}
        />
      )}

      {errorBanner}

      {showStaffLink && (
        <div className="mt-4 border-t border-line/40 pt-4 text-center">
          <p className="text-xs text-muted">
            Accessing the staff portal?{" "}
            <Link
              href="/staff-login"
              className="font-bold text-accent hover:underline"
            >
              Staff Sign-In →
            </Link>
          </p>
        </div>
      )}
    </div>
  );

  if (inline) return content;
  return <Card className="p-8">{content}</Card>;
}
