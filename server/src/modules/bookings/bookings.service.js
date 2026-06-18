import {
  AppError,
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
} from '../../utils/api-error.js';
import { formatTime, minutesToTimeDate, timeToMinutes, toDateOnly } from './booking-time.js';

const isUniqueConflict = (error) => error?.code === 'P2002';

const quoteToResponse = (quote) => ({
  units: quote.price_breakdown.units,
  subtotal: quote.price_breakdown.subtotal,
  coupon_discount: quote.price_breakdown.coupon_discount,
  tax: quote.price_breakdown.tax,
  total: quote.price_breakdown.total,
});

const serializeBooking = (booking) => ({
  id: booking.id,
  status: booking.status,
  venue: booking.venue ? {
    id: booking.venue.id,
    name: booking.venue.name,
  } : null,
  slot_date: toDateOnly(booking.slotDate),
  session_start_time: formatTime(booking.sessionStartTime),
  session_end_time: formatTime(booking.sessionEndTime),
  session_duration_mins: booking.sessionDurationMins,
  court_count: booking.courtCount,
  slot_unit_count: booking.slotUnitCount,
  total_amount: Number(booking.totalAmount || 0),
  credits_applied: Number(booking.creditsApplied || 0),
  expires_at: booking.expiresAt,
  waiver_accepted: booking.waiverAccepted,
  waiver_accepted_at: booking.waiverAcceptedAt,
  slots: (booking.slots || []).map((slot) => ({
    id: slot.id,
    court: slot.court ? {
      id: slot.court.id,
      name: slot.court.name,
    } : null,
    slot_date: toDateOnly(slot.slotDate),
    slot_start_time: formatTime(slot.slotStartTime),
    slot_end_time: formatTime(slot.slotEndTime),
    status: slot.status,
    unit_price: Number(slot.unitPrice || 0),
  })),
  payments: (booking.payments || []).map((payment) => ({
    id: payment.id,
    gateway: payment.gateway,
    merchant_order_id: payment.merchantOrderId,
    amount: Number(payment.amount || 0),
    status: payment.status,
    created_at: payment.createdAt,
  })),
});

export const createBookingsService = ({
  repository,
  availabilityService,
  selectionService,
  pricingService,
  paymentProvider = null,
  holdTtlSeconds = 10 * 60,
  activeHoldLimit = 2,
  clock = () => new Date(),
} = {}) => {
  if (!repository) throw new Error('repository is required');
  if (!availabilityService) throw new Error('availabilityService is required');
  if (!selectionService) throw new Error('selectionService is required');
  if (!pricingService) throw new Error('pricingService is required');

  const buildValidatedQuote = async ({ input }) => {
    const context = await repository.getHoldContext({
      venueId: input.venue_id,
      couponCode: input.coupon_code,
    });

    const availability = await availabilityService.getAvailability({
      venueId: input.venue_id,
      date: input.slot_date,
    });

    const selection = selectionService.validateSelection({
      venue: context.venue,
      courts: context.courts,
      availability,
      input,
    });

    const quote = pricingService.buildQuote({
      courts: selection.courts,
      slotDate: input.slot_date,
      slotStartTimes: selection.slotStartTimes,
      slotDurationMins: selection.slotDurationMins,
      pricingRules: context.pricingRules || [],
      coupon: context.coupon,
    });

    return {
      context,
      availability,
      selection,
      quote,
    };
  };

  return {
    async pricePreview({ input }) {
      const { quote } = await buildValidatedQuote({ input });
      return quote;
    },

    async createHold({ userId, input }) {
      const now = clock();
      const activeHoldCount = await repository.countActivePendingHolds({
        userId,
        now,
      });

      if (activeHoldCount >= activeHoldLimit) {
        throw new TooManyRequestsError('Active booking hold limit exceeded', { code: 'HOLD_LIMIT_EXCEEDED' });
      }

      const { context, selection, quote } = await buildValidatedQuote({ input });
      const expiresAt = new Date(now.getTime() + holdTtlSeconds * 1000);
      const slotUnits = quote.price_breakdown.units.map((unit) => ({
        courtId: unit.court_id,
        slotDate: new Date(`${input.slot_date}T00:00:00.000Z`),
        slotStartTime: minutesToTimeDate(timeToMinutes(unit.slot_start_time)),
        slotEndTime: minutesToTimeDate(timeToMinutes(unit.slot_end_time)),
        status: 'pending_payment',
        unitPrice: unit.unit_price,
      }));

      try {
        const booking = await repository.createHold({
          booking: {
            venueId: input.venue_id,
            userId,
            slotDate: new Date(`${input.slot_date}T00:00:00.000Z`),
            sessionStartTime: minutesToTimeDate(timeToMinutes(quote.session_start_time)),
            sessionEndTime: minutesToTimeDate(timeToMinutes(quote.session_end_time)),
            sessionDurationMins: quote.session_duration_mins,
            courtCount: quote.court_count,
            slotUnitCount: quote.slot_unit_count,
            status: 'pending_payment',
            bookingType: 'online',
            baseAmount: quote.price_breakdown.subtotal,
            discountAmount: quote.price_breakdown.coupon_discount,
            taxAmount: quote.price_breakdown.tax,
            totalAmount: quote.price_breakdown.total,
            couponId: context.coupon?.id || null,
            expiresAt,
          },
          slotUnits,
          now,
        });

        return {
          booking_id: booking.id,
          status: booking.status,
          expires_at: booking.expiresAt,
          court_count: quote.court_count,
          slot_unit_count: quote.slot_unit_count,
          session_start_time: quote.session_start_time,
          session_end_time: quote.session_end_time,
          session_duration_mins: quote.session_duration_mins,
          price_quote: quoteToResponse(quote),
        };
      } catch (error) {
        if (isUniqueConflict(error)) {
          const unavailable = await repository.findUnavailableUnits({
            venueId: input.venue_id,
            courtIds: selection.courts.map((court) => court.id),
            slotDate: input.slot_date,
            slotStartTimes: selection.slotStartTimes,
            now,
          });
          throw new ConflictError('Some of your selected slots were just taken.', {
            code: 'SLOTS_UNAVAILABLE',
            unavailable,
          });
        }
        throw error;
      }
    },

    async acceptWaiver({ userId, bookingId, requestContext = {} }) {
      const now = clock();
      const booking = await repository.getBookingForPayment({ bookingId, userId });
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.status === 'confirmed') {
        throw new ConflictError('Waiver already accepted for confirmed booking', { code: 'INVALID_BOOKING_STATE' });
      }

      if (booking.status !== 'pending_payment') {
        throw new ConflictError('Waiver cannot be accepted in this state', { code: 'INVALID_BOOKING_STATE' });
      }

      if (booking.expiresAt && booking.expiresAt <= now) {
        await repository.expireBooking({ bookingId, now });
        throw new AppError('Booking hold has expired', 410, { code: 'BOOKING_EXPIRED' });
      }

      const result = await repository.acceptWaiver({
        userId,
        bookingId,
        acceptedAt: now,
        ipAddress: requestContext.ipAddress || null,
      });

      return {
        waiver_accepted: true,
        waiver_accepted_at: result.waiverAcceptedAt,
      };
    },

    async initiatePayment({ userId, bookingId, input = {} }) {
      const now = clock();
      const booking = await repository.getBookingForPayment({ bookingId, userId });
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      if (booking.status === 'confirmed') {
        return {
          type: 'already_confirmed',
          booking_id: booking.id,
          booking_status: 'confirmed',
        };
      }

      if (booking.status !== 'pending_payment') {
        throw new ConflictError('Booking is not payable', { code: 'INVALID_BOOKING_STATE' });
      }

      if (booking.expiresAt && booking.expiresAt <= now) {
        await repository.expireBooking({ bookingId, now });
        throw new AppError('Booking hold has expired', 410, { code: 'BOOKING_EXPIRED' });
      }

      if (!booking.waiverAccepted) {
        throw new AppError('Waiver acceptance is required before payment', 422, { code: 'WAIVER_REQUIRED' });
      }

      const existingPayment = await repository.findReusableInitiatedPayment?.({ bookingId });
      if (existingPayment) {
        return {
          type: existingPayment.gateway,
          booking_id: booking.id,
          merchant_order_id: existingPayment.merchantOrderId,
          redirect_url: existingPayment.redirectUrl,
          credits_applied: Number(booking.creditsApplied || 0),
          phonepe_amount: Number(existingPayment.amount || 0),
          total_amount: Number(booking.totalAmount || 0),
          expires_at: booking.expiresAt,
        };
      }

      const totalAmount = Number(booking.totalAmount || 0);
      const walletBalance = Number(booking.user?.walletCredits || 0);
      const creditsApplied = input.use_wallet_credits ? Math.min(walletBalance, totalAmount) : 0;
      const providerAmount = Math.max(0, totalAmount - creditsApplied);

      if (providerAmount === 0) {
        const confirmation = await repository.confirmWalletOnlyPayment({
          bookingId,
          userId,
          creditsApplied,
          now,
        });

        return {
          type: 'wallet_only',
          booking_id: confirmation.booking.id,
          credits_applied: creditsApplied,
          total_amount: totalAmount,
          phonepe_amount: 0,
          booking_status: confirmation.booking.status,
        };
      }

      if (!paymentProvider) {
        throw new AppError('Payment provider is not configured', 503, { code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
      }

      const providerOrder = await paymentProvider.createPaymentOrder({
        booking,
        amount: providerAmount,
        currency: 'INR',
      });

      const initiated = await repository.initiateProviderPayment({
        bookingId,
        userId,
        providerOrder,
        creditsApplied,
        providerAmount,
        now,
      });

      return {
        type: providerOrder.gateway,
        booking_id: booking.id,
        merchant_order_id: providerOrder.merchant_order_id,
        redirect_url: providerOrder.redirect_url,
        credits_applied: creditsApplied,
        phonepe_amount: providerAmount,
        total_amount: totalAmount,
        expires_at: booking.expiresAt,
        payment_id: initiated.payment.id,
      };
    },

    async handleProviderPaymentEvent({
      merchantOrderId,
      state,
      payload = {},
    }) {
      const payment = await repository.getPaymentWithBooking({ merchantOrderId });
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      const booking = payment.booking;
      if (payment.status === 'success' && booking.status === 'confirmed') {
        return {
          merchant_order_id: merchantOrderId,
          booking_id: booking.id,
          booking_status: 'confirmed',
          payment_status: 'success',
          idempotent: true,
        };
      }

      if (state === 'COMPLETED') {
        if (booking.expiresAt && booking.expiresAt <= clock()) {
          throw new AppError('Booking hold has expired', 410, { code: 'BOOKING_EXPIRED' });
        }

        const result = await repository.confirmProviderPayment({
          paymentId: payment.id,
          bookingId: booking.id,
          payload,
          now: clock(),
        });

        return {
          merchant_order_id: merchantOrderId,
          booking_id: result.booking.id,
          booking_status: result.booking.status,
          payment_status: result.payment.status,
          idempotent: false,
        };
      }

      if (state === 'FAILED') {
        if (payment.status === 'failed') {
          return {
            merchant_order_id: merchantOrderId,
            booking_id: booking.id,
            booking_status: booking.status,
            payment_status: 'failed',
            idempotent: true,
          };
        }

        const result = await repository.failProviderPayment({
          paymentId: payment.id,
          bookingId: booking.id,
          rollbackCredits: Number(booking.creditsApplied || 0) > 0,
          payload,
          now: clock(),
        });

        return {
          merchant_order_id: merchantOrderId,
          booking_id: result.booking.id,
          booking_status: result.booking.status,
          payment_status: result.payment.status,
          idempotent: false,
        };
      }

      return {
        merchant_order_id: merchantOrderId,
        booking_id: booking.id,
        booking_status: booking.status,
        payment_status: payment.status,
        idempotent: false,
      };
    },

    async expirePendingHolds({ limit = 100 } = {}) {
      const now = clock();
      return repository.expirePendingHolds({ now, limit });
    },

    async getBooking({ userId, bookingId }) {
      const booking = await repository.getBooking({ userId, bookingId });
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      return serializeBooking(booking);
    },
  };
};
