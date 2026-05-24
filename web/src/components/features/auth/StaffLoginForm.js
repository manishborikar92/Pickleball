"use client";

import { useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/shared";
import { signInStaffAction } from "@/app/actions/auth-actions";
import { Shield } from "lucide-react";

/**
 * StaffLoginForm — Staff authentication only.
 *
 * Responsibilities:
 *  - Role-based staff selection (Staff, Manager, Super Admin)
 *  - Form submission to signInStaffAction server action
 *
 * Does NOT handle:
 *  - Customer authentication
 *  - Customer onboarding / name collection
 *  - Customer OTP validation
 */
export function StaffLoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";

  return (
    <Card className="p-8">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-black">Staff Single Sign-On</h1>
        <p className="mt-2 text-sm text-muted">
          This portal simulates Baseline Arena internal administrative credentials.
        </p>
      </div>

      <form action={signInStaffAction} className="grid gap-5">
        <input type="hidden" name="next" value={next} />
        
        <label className="grid gap-2 text-sm font-bold text-muted">
          Internal Role
          <select 
            name="role" 
            defaultValue="staff"
            className="rounded-xl border border-line bg-background p-3.5 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </label>

        <Button type="submit" className="w-full justify-center py-4 text-base">
          Sign In as Staff →
        </Button>
      </form>
    </Card>
  );
}
