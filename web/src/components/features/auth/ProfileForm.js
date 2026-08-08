"use client";

import { Phone, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, FormAlert, Input } from "@/components/shared";
import { updateProfileAction } from "@/lib/actions/auth";
import { nameSchema } from "@/lib/schemas";

export function ProfileForm({ initialName = "", phone = "" }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message || "Enter your full name.");
      setServerError("");
      setSuccess("");
      return;
    }

    setLoading(true);
    setFieldError("");
    setServerError("");
    setSuccess("");

    try {
      const result = await updateProfileAction(parsed.data);
      if (!result.ok) {
        setServerError(result.error.message || "Unable to update your profile.");
        return;
      }

      const canonicalName = result.data?.name || parsed.data;
      setName(canonicalName);
      setSuccess("Your profile has been updated.");
      router.refresh();
    } catch {
      setServerError("Unable to update your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
      <Card className="p-5 sm:p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">Personal details</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-foreground sm:text-2xl">Profile information</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Keep the name shown on your bookings and venue communications up to date.
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-sm font-bold text-muted">
              <label htmlFor="profile-name">
                Full name
                <span className="ml-1 text-accent" aria-hidden="true">*</span>
              </label>
              <span className="text-[10px] font-medium tracking-normal text-muted/60 normal-case sm:text-xs">
                2–100 characters
              </span>
            </div>
            <Input
              id="profile-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldError("");
                setServerError("");
              }}
              autoComplete="name"
              placeholder="Enter your full name"
              error={Boolean(fieldError)}
              aria-invalid={Boolean(fieldError)}
              aria-required="true"
              aria-describedby={fieldError ? "profile-name-help profile-name-error" : "profile-name-help"}
              disabled={loading}
            />
            {fieldError && (
              <p id="profile-name-error" className="text-xs font-semibold text-danger" role="alert">
                {fieldError}
              </p>
            )}
          </div>
          <p id="profile-name-help" className="-mt-3 text-xs leading-relaxed text-muted">
            This is the name our venue teams will see for your reservations.
          </p>

          <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-xs leading-relaxed text-muted">
              Updates apply to your account immediately and do not change your sign-in phone number.
            </p>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>

        <div className="mt-5 space-y-3">
          <FormAlert type="error" message={serverError} />
          <FormAlert type="success" message={success} />
        </div>
      </Card>

      <Card className="p-5 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-black text-foreground">Account details</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Your sign-in details are managed securely through WhatsApp OTP.
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-4">
          <div className="rounded-lg border border-line bg-background/40 p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted">Phone number</dt>
            <dd className="mt-1 break-all text-sm font-semibold text-foreground">{phone || "Verified phone number"}</dd>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-background/40 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <dt className="text-sm font-bold text-foreground">Customer account</dt>
              <dd className="mt-1 text-xs leading-relaxed text-muted">
                Only you can update this profile through your authenticated session.
              </dd>
            </div>
          </div>
        </dl>
      </Card>
    </div>
  );
}
