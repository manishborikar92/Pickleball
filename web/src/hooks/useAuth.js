import { useAuthContext } from "@/context/AuthContext";

/**
 * useAuth - Custom hook to consume the unified AuthContext.
 */
export function useAuth() {
  return useAuthContext();
}
