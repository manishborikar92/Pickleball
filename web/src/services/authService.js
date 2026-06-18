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
    const res = await sendCustomerOtpAction(phone);
    if (!res.success) throw new Error(res.error);
    return res.data;
  },

  async verifyCustomerOtp(phone, otp) {
    sessionStorage.setItem("pb_pending_phone", phone);
    const res = await verifyCustomerOtpAction(phone, otp);
    if (!res.success) throw new Error(res.error);
    return res.data;
  },

  async completeOnboarding(name) {
    const res = await completeOnboardingAction(name);
    if (!res.success) throw new Error(res.error);
    sessionStorage.removeItem("pb_pending_phone");
    return res.data;
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
