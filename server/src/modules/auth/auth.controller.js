import { ApiResponse } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/api-error.js';
import {
  createExpiredRefreshCookieOptions,
  createRefreshCookieOptions,
  getRefreshCookieName,
} from './auth.utils.js';

const serializeOtpSend = (result) => ({
  phone: result.phone,
  expires_in_seconds: result.expiresInSeconds,
  ...(result.sandboxOtp ? { sandbox_otp: result.sandboxOtp } : {}),
});

const setRefreshCookie = (res, config, rawRefreshToken) => {
  res.cookie(
    getRefreshCookieName(config),
    rawRefreshToken,
    createRefreshCookieOptions({
      apiPrefix: config.app.apiPrefix,
      domain: config.auth.refreshCookieDomain,
      isProduction: config.isProduction,
      refreshTokenTtlSeconds: config.auth.refreshTokenTtlSeconds,
    }),
  );
};

const clearRefreshCookie = (res, config) => {
  res.cookie(
    getRefreshCookieName(config),
    '',
    createExpiredRefreshCookieOptions({
      apiPrefix: config.app.apiPrefix,
      domain: config.auth.refreshCookieDomain,
      isProduction: config.isProduction,
    }),
  );
};

const authPayload = (result) => ({
  access_token: result.access_token,
  expires_in: result.expires_in,
  user: result.user,
  ...(result.next_step ? { next_step: result.next_step } : {}),
});

export const createAuthController = ({ authService }) => ({
  sendOtp: asyncHandler(async (req, res) => {
    const result = await authService.sendCustomerOtp({
      phone: req.validated.body.phone,
      ipAddress: req.ip,
    });

    res.json(ApiResponse.success(serializeOtpSend(result), 'OTP sent'));
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const config = req.app.get('config');
    const result = await authService.verifyCustomerOtp({
      phone: req.validated.body.phone,
      otp: req.validated.body.otp,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    setRefreshCookie(res, config, result.refreshToken.raw);
    res.json(ApiResponse.success(authPayload(result), 'OTP verified'));
  }),

  loginStaff: asyncHandler(async (req, res) => {
    const config = req.app.get('config');
    const result = await authService.loginStaff({
      email: req.validated.body.email,
      password: req.validated.body.password,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    setRefreshCookie(res, config, result.refreshToken.raw);
    res.json(ApiResponse.success(authPayload(result), 'Staff login successful'));
  }),

  refresh: asyncHandler(async (req, res) => {
    const config = req.app.get('config');
    const result = await authService.refreshSession({
      refreshToken: req.cookies?.[getRefreshCookieName(config)],
    });

    if (!result.skipCookieUpdate) {
      setRefreshCookie(res, config, result.refreshToken.raw);
    }
    res.json(ApiResponse.success(authPayload(result), 'Session refreshed'));
  }),

  logout: asyncHandler(async (req, res) => {
    const config = req.app.get('config');
    await authService.logoutCurrent({
      refreshToken: req.cookies?.[getRefreshCookieName(config)],
    });

    clearRefreshCookie(res, config);
    res.json(ApiResponse.success({ logged_out: true }, 'Logged out'));
  }),

  logoutAll: asyncHandler(async (req, res) => {
    const config = req.app.get('config');
    await authService.logoutAll({ userId: req.auth.subject });
    clearRefreshCookie(res, config);
    res.json(ApiResponse.success({ logged_out_all: true }, 'All sessions logged out'));
  }),
});
