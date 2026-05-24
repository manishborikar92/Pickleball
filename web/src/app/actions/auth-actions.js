"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, getSession } from "@/lib/session";
import { roles } from "@/lib/rbac";

/**
 * getSessionAction — Server Action wrapper for resolving active session.
 */
export async function getSessionAction(preferredType = null) {
  return await getSession(preferredType);
}

/**
 * signInStaffAction — Handles staff/manager/admin authentication only.
 * Sets dedicated staff cookies.
 */
export async function signInStaffAction(formData) {
  const role = String(formData.get("role") || "staff");
  const next = String(formData.get("next") || "/admin");

  // Restrict to internal/staff roles only (staff, manager, super_admin)
  const isStaffRole = role === "staff" || role === "manager" || role === "super_admin";
  const selectedRole = isStaffRole ? role : "staff";
  
  const cookieStore = await cookies();

  // Set the staff role session cookie
  cookieStore.set("pb_staff_role", selectedRole, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  // Set default staff metadata cookies to prevent reusing customer assumptions
  cookieStore.set("pb_staff_name", "Venue Operator", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  cookieStore.set("pb_staff_phone", "+919876543210", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(next);
}

/**
 * signInCustomerAction — Handles customer authentication session.
 */
export async function signInCustomerAction(name, phone) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, "customer", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  if (name) {
    cookieStore.set("pb_user_name", name, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
  } else {
    cookieStore.delete("pb_user_name");
  }

  cookieStore.set("pb_user_phone", phone, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/**
 * completeOnboardingAction — Customer name registration on onboarding completion.
 */
export async function completeOnboardingAction(name) {
  const cookieStore = await cookies();

  cookieStore.set("pb_user_name", name, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

/**
 * signOutCustomerAction — Deletes all customer cookies.
 */
export async function signOutCustomerAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete("pb_user_name");
  cookieStore.delete("pb_user_phone");
  redirect("/");
}

/**
 * signOutStaffAction — Deletes all staff cookies.
 */
export async function signOutStaffAction() {
  const cookieStore = await cookies();
  cookieStore.delete("pb_staff_role");
  cookieStore.delete("pb_staff_name");
  cookieStore.delete("pb_staff_phone");
  redirect("/staff-login");
}
