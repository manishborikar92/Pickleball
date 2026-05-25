"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { authService } from "@/services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      try {
        const activeSession = await authService.getSession();
        setSession(activeSession);
      } catch (err) {
        console.error("Failed to initialize session in provider:", err);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  // Login customer (Phone + OTP stage)
  const loginCustomer = useCallback(async (phone, name = "") => {
    setLoading(true);
    try {
      await authService.signInCustomer(phone, name);
      // Fetch the updated session
      const updatedSession = await authService.getSession("customer");
      setSession(updatedSession);
      return { ok: true, isNew: !name };
    } catch (err) {
      console.error("Customer login error in AuthProvider:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Complete onboarding (Name collection stage)
  const completeOnboarding = useCallback(async (name, phone) => {
    setLoading(true);
    try {
      await authService.completeOnboarding(name, phone);
      // Refetch customer session
      const updatedSession = await authService.getSession("customer");
      setSession(updatedSession);
      return { ok: true };
    } catch (err) {
      console.error("Onboarding completion error in AuthProvider:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Login staff (direct SSO)
  const loginStaff = useCallback(async (role, next = "/admin") => {
    setLoading(true);
    try {
      // Direct sign-in will trigger a server redirect, but we wrap it in service
      // Note: Staff login causes server redirect to next.
      // We will let the form submission handle the actual redirect, 
      // but we update local state beforehand just in case.
      const updatedSession = await authService.getSession("staff");
      setSession(updatedSession);
    } catch (err) {
      console.error("Staff login error in AuthProvider:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout customer
  const logoutCustomer = useCallback(async () => {
    setLoading(true);
    try {
      await authService.signOutCustomer();
      setSession(null);
    } catch (err) {
      console.error("Logout customer error in AuthProvider:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout staff
  const logoutStaff = useCallback(async () => {
    setLoading(true);
    try {
      await authService.signOutStaff();
      setSession(null);
    } catch (err) {
      console.error("Logout staff error in AuthProvider:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Memoize context value to avoid unnecessary re-renders
  const value = useMemo(() => {
    const isAuthenticated = !!session;
    const isStaff = isAuthenticated && session.role !== "customer";
    const isOnboarded = isAuthenticated && (isStaff || !!session.user?.name);

    return {
      session,
      user: session?.user || null,
      role: session?.role || null,
      permissions: session?.permissions || [],
      isAuthenticated,
      isStaff,
      isOnboarded,
      loading,
      loginCustomer,
      completeOnboarding,
      loginStaff,
      logoutCustomer,
      logoutStaff,
    };
  }, [session, loading, loginCustomer, completeOnboarding, loginStaff, logoutCustomer, logoutStaff]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
