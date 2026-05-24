import {
  signInCustomerAction,
  completeOnboardingAction,
  signOutCustomerAction,
  signOutStaffAction,
  getSessionAction,
} from "@/app/actions/auth-actions";

/**
 * authService - Isolates authentication side-effects, session storage keys,
 * and Server Action communication.
 */
export const authService = {
  /**
   * Fetches the current session via server action.
   * @param {string} [preferredType] 'customer' | 'staff'
   */
  async getSession(preferredType = null) {
    try {
      return await getSessionAction(preferredType);
    } catch (error) {
      console.error("Failed to retrieve session:", error);
      return null;
    }
  },

  /**
   * Signs in a customer by verifying phone, calling the sign-in server action,
   * and transiently setting the pending phone.
   * @param {string} phone Normalized phone number (+91...)
   * @param {string} [name] Name (if returning user)
   */
  async signInCustomer(phone, name = "") {
    // Transiently store pending phone for onboarding
    sessionStorage.setItem("pb_pending_phone", phone);
    
    // Call server action to write HttpOnly cookie
    await signInCustomerAction(name, phone);
  },

  /**
   * Completes onboarding for a customer by saving name to local storage
   * registry and calling the completion server action.
   * @param {string} name Full name
   * @param {string} phone Normalized phone number (+91...)
   */
  async completeOnboarding(name, phone) {
    // Persist registration details locally (simulates database)
    const registeredUsers = JSON.parse(
      localStorage.getItem("pb_registered_users") || "{}"
    );
    registeredUsers[phone] = name;
    localStorage.setItem("pb_registered_users", JSON.stringify(registeredUsers));

    // Call server action to write pb_user_name HttpOnly cookie
    await completeOnboardingAction(name);

    // Clean up transient pending state
    sessionStorage.removeItem("pb_pending_phone");
  },

  /**
   * Checks the user registry in local storage to see if a phone is returning.
   * @param {string} phone Normalized phone number (+91...)
   * @returns {string|null} Stored name if registered, otherwise null
   */
  getRegisteredName(phone) {
    if (typeof window === "undefined") return null;
    const registeredUsers = JSON.parse(
      localStorage.getItem("pb_registered_users") || "{}"
    );
    return registeredUsers[phone] || null;
  },

  /**
   * Resolves the phone number pending onboarding.
   * Looks at transient session storage, falling back to the last registered user.
   */
  resolvePendingPhone() {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("pb_pending_phone");
    if (stored) return stored;

    const registeredUsers = JSON.parse(
      localStorage.getItem("pb_registered_users") || "{}"
    );
    return Object.keys(registeredUsers).slice(-1)[0] || "";
  },

  /**
   * Logs out customer.
   */
  async signOutCustomer() {
    await signOutCustomerAction();
  },

  /**
   * Logs out staff.
   */
  async signOutStaff() {
    await signOutStaffAction();
  },
};
