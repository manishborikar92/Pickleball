"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { authService } from "@/services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const isHydrated = useRef(false);

  // Atomic session initializer to avoid exposing raw state setters
  const initializeSession = useCallback((newSession) => {
    isHydrated.current = true;
    setSession(newSession);
    setLoading(false);
  }, []);

  // Initialize session on mount
  useEffect(() => {
    if (isHydrated.current) return;

    async function initSession() {
      try {
        const activeSession = await authService.getSession();
        if (isHydrated.current) return;
        setSession(activeSession);
      } catch (err) {
        console.error("Failed to initialize session in provider:", err);
      } finally {
        if (!isHydrated.current) {
          setLoading(false);
        }
      }
    }
    initSession();
  }, []);

  const sendCustomerOtp = useCallback(async (phone) => {
    return authService.sendCustomerOtp(phone);
  }, []);

  // Login customer (Phone + OTP stage)
  const loginCustomer = useCallback(async (phone, otp) => {
    setLoading(true);
    try {
      const result = await authService.verifyCustomerOtp(phone, otp);
      // Fetch the updated session
      const updatedSession = await authService.getSession("customer");
      setSession(updatedSession);
      return { ok: true, nextStep: result.next_step };
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
      sendCustomerOtp,
      loginCustomer,
      completeOnboarding,
      loginStaff,
      logoutCustomer,
      logoutStaff,
      initializeSession,
    };
  }, [session, loading, sendCustomerOtp, loginCustomer, completeOnboarding, loginStaff, logoutCustomer, logoutStaff, initializeSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
