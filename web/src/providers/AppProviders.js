"use client";

import { AuthProvider } from "@/context/AuthContext";

/**
 * AppProviders - Composes all client-side global providers.
 */
export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
