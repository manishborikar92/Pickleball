import {
  sendCustomerOtpAction,
  verifyCustomerOtpAction,
  completeOnboardingAction,
  signOutCustomerAction,
  signOutStaffAction,
  getSessionAction,
} from "@/app/actions/auth-actions";

export const authService = {
  async getSession(preferredType = null) {
    try {
      return await getSessionAction(preferredType);
    } catch (error) {
      console.error("Failed to retrieve session:", error);
      return null;
    }
  },

  async sendCustomerOtp(phone) {
    sessionStorage.setItem("pb_pending_phone", phone);
    return await sendCustomerOtpAction(phone);
  },

  async verifyCustomerOtp(phone, otp) {
    sessionStorage.setItem("pb_pending_phone", phone);
    return await verifyCustomerOtpAction(phone, otp);
  },

  async completeOnboarding(name) {
    const result = await completeOnboardingAction(name);
    sessionStorage.removeItem("pb_pending_phone");
    return result;
  },

  resolvePendingPhone() {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("pb_pending_phone") || "";
  },

  async signOutCustomer() {
    await signOutCustomerAction();
  },

  async signOutStaff() {
    await signOutStaffAction();
  },
};
