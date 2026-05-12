"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE } from "@/lib/session";
import { roles } from "@/lib/rbac";

export async function signInDemo(formData) {
  const role = String(formData.get("role") || "customer");
  const next = String(formData.get("next") || "/dashboard");
  const selectedRole = roles[role] ? role : "customer";
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, selectedRole, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(next);
}

export async function signOutDemo() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
