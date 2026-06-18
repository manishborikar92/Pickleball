import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

const requestContext = (req) => ({
  requestId: req.id,
  ipAddress: req.ip,
  userAgent: req.get('user-agent') || null,
});

export const createBookingsController = ({ bookingsService }) => ({
  pricePreview: asyncHandler(async (req, res) => {
    const result = await bookingsService.pricePreview({
      input: req.validated.body,
      requestContext: requestContext(req),
    });
    res.json(ApiResponse.success(result, 'Price preview calculated'));
  }),

  createHold: asyncHandler(async (req, res) => {
    const result = await bookingsService.createHold({
      userId: req.auth.subject,
      input: req.validated.body,
      requestContext: requestContext(req),
    });
    res.status(201).json(ApiResponse.success(result, 'Booking hold created'));
  }),

  acceptWaiver: asyncHandler(async (req, res) => {
    const result = await bookingsService.acceptWaiver({
      userId: req.auth.subject,
      bookingId: req.validated.params.bookingId,
      input: req.validated.body,
      requestContext: requestContext(req),
    });
    res.json(ApiResponse.success(result, 'Waiver accepted'));
  }),

  initiatePayment: asyncHandler(async (req, res) => {
    const result = await bookingsService.initiatePayment({
      userId: req.auth.subject,
      bookingId: req.validated.params.bookingId,
      input: req.validated.body,
      requestContext: requestContext(req),
    });
    res.json(ApiResponse.success(result, 'Payment initiated'));
  }),

  getBooking: asyncHandler(async (req, res) => {
    const result = await bookingsService.getBooking({
      userId: req.auth.subject,
      bookingId: req.validated.params.bookingId,
    });
    res.json(ApiResponse.success(result));
  }),
});
