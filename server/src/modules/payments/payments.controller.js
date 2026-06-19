import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';

const requestContext = (req) => ({
  requestId: req.id,
  ipAddress: req.ip,
  userAgent: req.get('user-agent') || null,
});

export const createPaymentsController = ({ paymentsService }) => ({
  getPaymentStatus: asyncHandler(async (req, res) => {
    const result = await paymentsService.getPaymentStatus({
      userId: req.auth.subject,
      merchantOrderId: req.validated.params.merchantOrderId,
      requestContext: requestContext(req),
    });
    res.json(ApiResponse.success(result));
  }),

  completeSandboxPayment: asyncHandler(async (req, res) => {
    const result = await paymentsService.completeSandboxPayment({
      merchantOrderId: req.validated.params.merchantOrderId,
      requestContext: requestContext(req),
    });
    res.json(ApiResponse.success(result, 'Sandbox payment completed'));
  }),

  failSandboxPayment: asyncHandler(async (req, res) => {
    const result = await paymentsService.failSandboxPayment({
      merchantOrderId: req.validated.params.merchantOrderId,
      requestContext: requestContext(req),
    });
    res.json(ApiResponse.success(result, 'Sandbox payment failed'));
  }),

  refundPayment: asyncHandler(async (req, res) => {
    const result = await paymentsService.refundPayment({
      paymentId: req.validated.params.paymentId,
      amount: req.validated.body.amount,
      userId: req.auth.subject,
    });
    res.json(ApiResponse.success(result, 'Refund initiated'));
  }),

  retryRefund: asyncHandler(async (req, res) => {
    const result = await paymentsService.retryRefund({
      paymentId: req.validated.params.paymentId,
      userId: req.auth.subject,
    });
    res.json(ApiResponse.success(result, 'Refund retry initiated'));
  }),
});
