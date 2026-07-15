"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, FormAlert } from "@/components/shared";
import { sendCustomerOtpAction, verifyCustomerOtpAction } from "@/lib/actions/auth";
import { safeNext } from "@/lib/safeNext";
import { PhoneForm } from "./steps/PhoneForm";
import { OtpForm } from "./steps/OtpForm";

/**
 * CustomerLoginForm — Phone + OTP authentication using server actions directly.
 */
export function CustomerLoginForm({ onSuccess, showAdminLink = false, inline = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePhoneSubmit(verifiedPhone) {
    setLoading(true);
    setError("");
    try {
      const res = await sendCustomerOtpAction(verifiedPhone);
      if (!res.ok) throw new Error(res.error.message);
      setPhone(verifiedPhone);
      setStep("otp");
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(otpCode) {
    setLoading(true);
    setError("");

    try {
      const res = await verifyCustomerOtpAction(phone, otpCode);
      if (!res.ok) throw new Error(res.error.message);

      const nextStep = res.data?.next_step;

      if (onSuccess) {
        onSuccess({ phone, isNew: nextStep === "complete_onboarding" });
      } else {
        const next = safeNext(searchParams.get("next"), "/dashboard/overview");
        if (nextStep === "complete_onboarding") {
          router.push(`/onboarding?next=${encodeURIComponent(next)}`);
        } else {
          router.push(next);
        }
        router.refresh();
      }
    } catch (err) {
      setError("Failed to verify OTP. Please try again.");
    } finally {
      setLoading(false);
    }
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

      {showAdminLink && (
        <div className="mt-4 border-t border-line/40 pt-4 text-center">
          <p className="text-xs text-muted">
            Accessing the admin portal?{" "}
            <Link
              href="/admin/login"
              className="font-bold text-accent hover:underline"
            >
              Admin Sign-In →
            </Link>
          </p>
        </div>
      )}
    </div>
  );

  if (inline) return content;
  return <Card className="p-8">{content}</Card>;
}
