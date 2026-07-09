import {
  addMinutesToTime,
  getDayName,
  roundMoney,
  timeToMinutes,
} from './booking-time.js';

const getAmount = (value) => Number(value?.toString?.() ?? value ?? 0);

const matchesTimeWindow = (rule, slotStartTime) => {
  const start = rule.start_time || rule.startTime;
  const end = rule.end_time || rule.endTime;
  if (!start || !end) return true;
  const slotMinutes = timeToMinutes(slotStartTime);
  return slotMinutes >= timeToMinutes(start) && slotMinutes < timeToMinutes(end);
};

const matchesRule = ({ rule, court, slotDate, slotStartTime }) => {
  if (!rule?.type) return false;

  if (!matchesTimeWindow(rule, slotStartTime)) {
    return false;
  }

  if (Array.isArray(rule.days) && rule.days.length > 0) {
    const day = getDayName(slotDate);
    if (!rule.days.includes(day)) {
      return false;
    }
  }

  if (rule.type === 'court_modifier') {
    return !rule.environment || rule.environment === court.environment;
  }

  return ['time_modifier', 'flash_sale'].includes(rule.type);
};

const applyAdjustment = (amount, rule) => {
  const value = Number(rule.value || 0);
  if (rule.adjustment_type === 'percentage' || rule.adjustmentType === 'percentage') {
    return amount + (amount * value / 100);
  }
  return amount + value;
};

const normalizeCoupon = (coupon) => {
  if (!coupon) return null;
  return {
    code: coupon.code,
    discountType: coupon.discountType || coupon.discount_type,
    discountValue: getAmount(coupon.discountValue ?? coupon.discount_value),
  };
};

export const createBookingPricingService = ({ taxRate } = {}) => {
  if (taxRate === undefined) {
    throw new Error('taxRate is required to initialize BookingPricingService');
  }

  return {
    calculateUnitPrice({
      court,
      slotDate,
      slotStartTime,
      pricingRules = [],
    }) {
      const base = getAmount(court.basePrice?.amount ?? court.base_price?.amount ?? court.price);
      const activeRules = pricingRules
        .filter((rule) => rule?.isActive !== false && (!rule.courtId || rule.courtId === court.id))
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

      const adjusted = activeRules.reduce((amount, pricingRule) => {
        const rule = pricingRule.rule || {};
        if (!matchesRule({ rule, court, slotDate, slotStartTime })) {
          return amount;
        }
        return applyAdjustment(amount, rule);
      }, base);

      return roundMoney(Math.max(0, adjusted));
    },

    buildQuote({
      courts = [],
      slotDate,
      slotStartTimes = [],
      slotDurationMins = 60,
      pricingRules = [],
      coupon = null,
    }) {
      const units = courts.flatMap((court) => slotStartTimes.map((slotStartTime) => {
        const unitPrice = this.calculateUnitPrice({
          court,
          slotDate,
          slotStartTime,
          pricingRules,
        });

        return {
          court_id: court.id,
          court_name: court.name,
          slot_start_time: slotStartTime,
          slot_end_time: addMinutesToTime(slotStartTime, slotDurationMins),
          unit_price: unitPrice,
        };
      }));

      const subtotal = roundMoney(units.reduce((sum, unit) => sum + unit.unit_price, 0));
      const normalizedCoupon = normalizeCoupon(coupon);
      let couponDiscount = 0;

      if (normalizedCoupon?.discountType === 'flat') {
        couponDiscount = Math.min(normalizedCoupon.discountValue, subtotal);
      } else if (normalizedCoupon?.discountType === 'percentage') {
        couponDiscount = subtotal * normalizedCoupon.discountValue / 100;
      }

      const taxable = Math.max(0, subtotal - couponDiscount);
      const tax = roundMoney(taxable * taxRate);
      const total = roundMoney(taxable + tax);
      const sessionStart = slotStartTimes[0];
      const sessionEnd = addMinutesToTime(slotStartTimes[slotStartTimes.length - 1], slotDurationMins);

      return {
        court_count: courts.length,
        slot_count: slotStartTimes.length,
        slot_unit_count: units.length,
        session_start_time: sessionStart,
        session_end_time: sessionEnd,
        session_duration_mins: slotStartTimes.length * slotDurationMins,
        price_breakdown: {
          units,
          subtotal,
          coupon_discount: roundMoney(couponDiscount),
          tax,
          total,
        },
      };
    }
  };
};
