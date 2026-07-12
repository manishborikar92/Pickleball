"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, FormAlert } from "@/components/shared";
import {
  sendCustomerOtpAction,
  verifyCustomerOtpAction,
  completeOnboardingAction,
} from "@/lib/actions/auth";
import { PhoneForm } from "./steps/PhoneForm";
import { OtpForm } from "./steps/OtpForm";
import { NameForm } from "./steps/NameForm";

/**
 * CustomerCheckoutAuthGate — Inline phone verification and profile onboarding.
 * Calls server actions directly instead of going through AuthContext.
 */
export function CustomerCheckoutAuthGate({
  inline = false,
  onSuccess,
  showAdminLoginLink = false,
  collectName = true,
  initialPhone = "",
  initialStep = "phone",
}) {
  const [step, setStep] = useState(initialStep);
  const [phone, setPhone] = useState(initialPhone);
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
      setError(err.message || "Failed to send OTP.");
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

      // The verify response already carries the user + next_step, so there is no
      // need for a second /users/me round-trip via getSessionAction (ME-17).
      const nextStep = res.data?.next_step;
      const existingName = res.data?.user?.name || "";

      if (nextStep !== "complete_onboarding" && existingName) {
        if (onSuccess) {
          onSuccess({ name: existingName, phone, isNew: false });
        }
      } else {
        if (collectName) {
          setStep("name");
        } else if (onSuccess) {
          onSuccess({ name: "", phone, isNew: true });
        }
      }
    } catch (err) {
      setError(err.message || "Failed to verify code and initialize session.");
    } finally {
      setLoading(false);
    }
  }

  async function handleNameSubmit(fullName) {
    setLoading(true);
    setError("");

    try {
      const res = await completeOnboardingAction(fullName);
      if (!res.ok) throw new Error(res.error.message);
      if (onSuccess) {
        onSuccess({ name: fullName, phone, isNew: true });
      }
    } catch (err) {
      setError(err.message || "Failed to save profile name.");
    } finally {
      setLoading(false);
    }
  }

  const errorBanner = <FormAlert type="error" message={error} />;

  const innerForm = (
    <div className="space-y-6">
      {step === "phone" && (
        <PhoneForm
          initialPhone={phone}
          onSubmit={handlePhoneSubmit}
          loading={loading}
          title="Verify to Continue"
          subtitle="Enter your phone to receive a 6-digit WhatsApp OTP."
        />
      )}

      {step === "otp" && (
        <OtpForm
          phone={phone}
          onSubmit={handleOtpSubmit}
          loading={loading}
          title="Enter Code"
        />
      )}

      {step === "name" && (
        <NameForm
          onSubmit={handleNameSubmit}
          loading={loading}
          title="Almost there!"
          subtitle="Tell us your name to finish your onboarding profile."
        />
      )}

      {errorBanner}

      {showAdminLoginLink && (
        <div className="mt-4 text-center border-t border-line/40 pt-4">
          <p className="text-xs text-muted">
            Accessing admin portal?{" "}
            <Link
              href="/admin/login"
              className="font-bold text-accent hover:underline"
            >
              Admin Sign-In
            </Link>
          </p>
        </div>
      )}
    </div>
  );

  if (inline) {
    return innerForm;
  }

  return <Card className="p-8">{innerForm}</Card>;
}
