import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const PHONE_REGEX = /^[6-9]\d{9}$/;
const REFRESH_COOKIE_NAME = 'pb_refresh_token';

export const normalizeIndianPhone = (input) => {
  const digits = String(input || '').replace(/\D/g, '');
  const national = digits.startsWith('91') && digits.length === 12
    ? digits.slice(2)
    : digits;

  if (!PHONE_REGEX.test(national)) {
    return null;
  }

  return `+91${national}`;
};

export const createOtpHash = async (otp) => bcrypt.hash(String(otp), 10);

export const verifyOtpHash = async (otp, hash) => {
  if (!otp || !hash) {
    return false;
  }

  return bcrypt.compare(String(otp), hash);
};

export const createPasswordHash = async (password) => bcrypt.hash(String(password), 12);

export const verifyPasswordHash = async (password, hash) => {
  if (!password || !hash) {
    return false;
  }

  return bcrypt.compare(String(password), hash);
};

export const createAccessToken = ({
  userId,
  sessionId,
  _roles = [],
  _permissions = [],
  config,
  now = new Date(),
}) => {
  const payload = {
    sub: userId,
    sid: sessionId,
  };

  const options = {
    expiresIn: config.accessTokenTtlSeconds,
    ...(config.issuer ? { issuer: config.issuer } : {}),
    ...(config.audience ? { audience: config.audience } : {}),
    noTimestamp: false,
  };

  const iat = Math.floor(now.getTime() / 1000);
  return jwt.sign({ ...payload, iat }, config.accessTokenSecret, options);
};

export const hashRefreshToken = (rawToken) => crypto
  .createHash('sha256')
  .update(String(rawToken))
  .digest('hex');

export const createRefreshToken = ({
  randomBytes = crypto.randomBytes,
} = {}) => {
  const raw = randomBytes(32).toString('base64url');
  return {
    raw,
    hash: hashRefreshToken(raw),
  };
};

export const getRefreshCookieName = (config = {}) => (
  config?.auth?.refreshCookieName || REFRESH_COOKIE_NAME
);

export const createRefreshCookieOptions = ({
  apiPrefix = '/api/v1',
  domain,
  isProduction = false,
  refreshTokenTtlSeconds,
}) => ({
  httpOnly: true,
  secure: Boolean(isProduction),
  sameSite: 'lax',
  path: `${apiPrefix.replace(/\/$/, '')}/auth`,
  ...(domain ? { domain } : {}),
  maxAge: refreshTokenTtlSeconds * 1000,
});

export const createExpiredRefreshCookieOptions = ({
  apiPrefix = '/api/v1',
  domain,
  isProduction = false,
} = {}) => ({
  httpOnly: true,
  secure: Boolean(isProduction),
  sameSite: 'lax',
  path: `${apiPrefix.replace(/\/$/, '')}/auth`,
  ...(domain ? { domain } : {}),
  maxAge: 0,
});
