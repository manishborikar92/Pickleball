"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button, Card, FormField, Input, FormAlert } from "@/components/shared";
import { signInAdminAction } from "@/lib/actions/auth";
import { safeNext } from "@/lib/safeNext";
import { Lock, Mail, Shield } from "lucide-react";

/**
 * AdminLoginForm — Admin (back-office) authentication only.
 *
 * Responsibilities:
 *  - Email/password credential submission to signInAdminAction
 *
 * Does NOT handle:
 *  - Customer authentication
 *  - Customer onboarding / name collection
 *  - Customer OTP validation
 */
export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"), "/admin/overview");
  const [state, formAction] = useActionState(signInAdminAction, { success: false, error: "" });

  return (
    <Card className="p-8">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-black">Admin Sign In</h1>
        <p className="mt-2 text-sm text-muted">
          Access the Baseline Arena administrative portal.
        </p>
      </div>

      <form action={formAction} className="grid gap-5">
        <input type="hidden" name="next" value={next} />

        <FormField label="Email" required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            icon={Mail}
            placeholder="manager@besanagpur.com"
            required
          />
        </FormField>

        <FormField label="Password" required>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            icon={Lock}
            placeholder="Enter password"
            required
          />
        </FormField>

        <FormAlert type="error" message={state?.error} />

        <SubmitButton />
      </form>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full justify-center py-4 text-base">
      {pending ? "Signing in…" : "Sign In as Admin →"}
    </Button>
  );
}
