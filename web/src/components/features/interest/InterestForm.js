"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, User, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/shared";


export function InterestForm() {
  const [form, setForm] = useState({ name: "", phone: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();

    if (name.length < 2) {
      setErrorMessage("Please enter your full name.");
      setStatus("error");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit Indian phone number.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const payload = {
        name,
        phone: `+91 ${phone}`,
        source: "Waitlist Form"
      };

      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatus("success");
        setForm({ name: "", phone: "" });
      } else {
        throw new Error("Submission failed.");
      }
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center sm:py-12">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground sm:text-3xl">
            You&apos;re on the list!
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            We&apos;ll notify you as soon as Baseline Arena opens for bookings.
            Get ready to play!
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-sm font-bold text-accent hover:underline"
        >
          Register another player
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Name field */}
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
          Full Name
        </span>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <User className="h-4 w-4 text-muted" aria-hidden="true" />
          </div>
          <input
            id="interest-name"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Rahul Sharma"
            autoComplete="name"
            required
            className="w-full rounded-xl border border-line bg-surface py-3.5 pl-11 pr-4 text-base text-foreground placeholder:text-muted/70 shadow-inner transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </label>

      {/* Phone field */}
      <label className="block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
          Phone Number
        </span>
        <div className="mt-1">
          <div className="flex overflow-hidden rounded-xl border border-line bg-surface shadow-inner transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <span className="flex shrink-0 items-center gap-1.5 border-r border-line bg-surface-soft px-4 text-sm font-bold text-muted">
              🇮🇳 +91
            </span>
            <input
              id="interest-phone"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="98765 43210"
              inputMode="tel"
              autoComplete="tel"
              maxLength={11}
              required
              className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-base text-foreground placeholder:text-muted/70 focus:outline-none"
            />
          </div>
        </div>
      </label>

      {/* Error state */}
      {status === "error" && errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 py-3.5 sm:py-4 text-[15px] sm:text-base font-bold disabled:opacity-60"
      >
        {status === "loading" ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            Submitting…
          </>
        ) : (
          <>
            <span className="sm:hidden">Notify Me</span>
            <span className="hidden sm:inline">Notify Me When Live</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted/60">
        No spam — we only reach out when courts are ready.
      </p>
    </form>
  );
}
