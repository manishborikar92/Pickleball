const collapseSpaces = (value) => value.trim().replace(/\s+/g, " ");

export function validateName(name) {
  const value = collapseSpaces(String(name || ""));
  if (value.length < 2) {
    return { ok: false, message: "Enter your full name." };
  }
  return { ok: true, value };
}

export function validatePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const national = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits;

  if (!/^[6-9]\d{9}$/.test(national)) {
    return { ok: false, message: "Enter a valid 10-digit Indian mobile number." };
  }

  return { ok: true, value: `+91${national}` };
}

export function validateOtp(otp) {
  const value = String(otp || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(value)) {
    return { ok: false, message: "Enter the 6-digit verification code." };
  }
  return { ok: true, value };
}

export function validateReview({ rating, comment = "", photoName = "" }) {
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return { ok: false, message: "Choose a star rating before submitting." };
  }

  return {
    ok: true,
    value: {
      rating: numericRating,
      comment: collapseSpaces(String(comment || "")),
      photoName: String(photoName || ""),
    },
  };
}

export function validateCoupon(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!value) return { ok: false, message: "Enter a promo code." };
  if (value !== "FIRST50" && value !== "BESA100") {
    return { ok: false, message: "This promo code is not active." };
  }
  return { ok: true, value };
}
