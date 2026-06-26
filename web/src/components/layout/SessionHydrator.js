"use client";

import { useEffect, useRef } from "react";
import { useAuthContext } from "@/context/AuthContext";

/**
 * SessionHydrator - Client component to bridge server-side session to client AuthContext.
 */
export function SessionHydrator({ session }) {
  const { initializeSession } = useAuthContext();
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!hasHydrated.current && session) {
      initializeSession(session);
      hasHydrated.current = true;
    }
  }, [session, initializeSession]);

  return null;
}
