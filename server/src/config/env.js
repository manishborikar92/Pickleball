import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config({ quiet: true });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  HOST: Joi.string().default('0.0.0.0'),
  API_PREFIX: Joi.string().pattern(/^\/[a-z0-9/-]*$/i).default('/api/v1'),
  APP_NAME: Joi.string().default('Enterprise Express API'),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
  TRUST_PROXY: Joi.alternatives().try(Joi.boolean(), Joi.number()).default(1),
  ALLOWED_ORIGINS: Joi.string().allow('').default('http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173'),
  CORS_CREDENTIALS: Joi.boolean().truthy('true').falsy('false').default(false),
  JSON_BODY_LIMIT: Joi.string().default('1mb'),
  URLENCODED_BODY_LIMIT: Joi.string().default('1mb'),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().integer().positive().default(500),
  JWT_ACCESS_SECRET: Joi.string().min(24).default('development-access-secret-change-before-production'),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(15 * 60),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().positive().default(30 * 24 * 60 * 60),
  JWT_ISSUER: Joi.string().allow('').default('baseline-api'),
  JWT_AUDIENCE: Joi.string().allow('').default('baseline-web'),
  REFRESH_COOKIE_NAME: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).default('pb_refresh_token'),
  REFRESH_COOKIE_DOMAIN: Joi.string().hostname().allow('').default(''),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).allow('').default(''),
  DATABASE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OTP_MODE: Joi.string().valid('sandbox', 'test', 'production').default('sandbox'),
  OTP_TEST_CODE: Joi.string().pattern(/^\d{6}$/).default('123456'),
  OTP_TTL_SECONDS: Joi.number().integer().positive().default(5 * 60),
  OTP_MAX_ATTEMPTS: Joi.number().integer().positive().default(5),
  WHATSAPP_API_BASE_URL: Joi.string().uri().default('https://graph.facebook.com'),
  WHATSAPP_API_VERSION: Joi.string().pattern(/^v\d+\.\d+$/).default('v20.0'),
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').default(''),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').default(''),
  WHATSAPP_OTP_TEMPLATE_NAME: Joi.string().allow('').default(''),
  WHATSAPP_OTP_TEMPLATE_LANGUAGE: Joi.string().allow('').default('en_US'),
  SHUTDOWN_TIMEOUT_MS: Joi.number().integer().positive().default(10000),

  // PhonePe Payment Gateway — credentials provided via merchant dashboard.
  PHONEPE_CLIENT_ID: Joi.string().allow('').default(''),
  PHONEPE_CLIENT_SECRET: Joi.string().allow('').default(''),
  PHONEPE_CLIENT_VERSION: Joi.number().integer().positive().default(1),
  PHONEPE_MERCHANT_ID: Joi.string().allow('').default(''),
  PHONEPE_ENV: Joi.string().valid('SANDBOX', 'PRODUCTION').default('SANDBOX'),
  PHONEPE_WEBHOOK_USERNAME: Joi.string().allow('').default(''),
  PHONEPE_WEBHOOK_PASSWORD: Joi.string().allow('').default(''),

  // Base URLs for payment redirect and webhook routing.
  FRONTEND_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  BACKEND_BASE_URL: Joi.string().uri().default('http://localhost:5000'),
  BOOKING_TAX_RATE: Joi.number().min(0).default(0.00),

  // Background scheduler — in-process periodic job runner.
  SCHEDULER_INTERVAL_MS: Joi.number().integer().min(30000).default(5 * 60 * 1000),
  DISABLE_INTERNAL_SCHEDULER: Joi.boolean().truthy('true').falsy('false').default(false),
}).unknown(true);

const parseCsv = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const deepMerge = (base, overrides = {}) => {
  const output = { ...base };

  for (const [key, value] of Object.entries(overrides || {})) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && base[key]
      && typeof base[key] === 'object'
      && !Array.isArray(base[key])
    ) {
      output[key] = deepMerge(base[key], value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
};

export const buildConfig = (overrides = {}) => {
  const { value, error } = envSchema.validate(process.env, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    const message = error.details.map((detail) => detail.message).join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  if (value.NODE_ENV === 'production' || value.NODE_ENV === 'staging') {
    if (value.JWT_ACCESS_SECRET === 'development-access-secret-change-before-production') {
      throw new Error('JWT_ACCESS_SECRET must be set in production/staging');
    }

    if (value.DATABASE_ENABLED && !value.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set when DATABASE_ENABLED=true in production/staging');
    }

    if (value.NODE_ENV === 'production' && !value.CORS_CREDENTIALS) {
      throw new Error('CORS_CREDENTIALS must be true when using cookie-based auth in production');
    }



    if (value.OTP_MODE === 'production' && (!value.WHATSAPP_ACCESS_TOKEN || !value.WHATSAPP_PHONE_NUMBER_ID)) {
      throw new Error('WhatsApp credentials must be set when OTP_MODE=production');
    }

    if (value.OTP_MODE === 'production' && (!value.WHATSAPP_OTP_TEMPLATE_NAME || !value.WHATSAPP_OTP_TEMPLATE_LANGUAGE)) {
      throw new Error('WhatsApp OTP template settings must be set when OTP_MODE=production');
    }

    if (parseCsv(value.ALLOWED_ORIGINS).length === 0) {
      throw new Error('ALLOWED_ORIGINS must contain at least one origin in production');
    }

    // PhonePe credentials are mandatory in production/staging.
    const phonePeRequired = ['PHONEPE_CLIENT_ID', 'PHONEPE_CLIENT_SECRET', 'PHONEPE_MERCHANT_ID', 'PHONEPE_WEBHOOK_USERNAME', 'PHONEPE_WEBHOOK_PASSWORD'];
    const phonePeMissing = phonePeRequired.filter((key) => !value[key]);
    if (phonePeMissing.length > 0) {
      throw new Error(`PhonePe credentials must be set in ${value.NODE_ENV}: ${phonePeMissing.join(', ')}`);
    }
  }

  const config = {
    env: value.NODE_ENV,
    isProduction: value.NODE_ENV === 'production',
    isTest: value.NODE_ENV === 'test',
    app: {
      name: value.APP_NAME,
      port: value.PORT,
      host: value.HOST,
      apiPrefix: value.API_PREFIX,
      trustProxy: value.TRUST_PROXY,
      shutdownTimeoutMs: value.SHUTDOWN_TIMEOUT_MS,
    },
    logger: {
      level: value.LOG_LEVEL,
    },
    security: {
      allowedOrigins: parseCsv(value.ALLOWED_ORIGINS),
      corsCredentials: value.CORS_CREDENTIALS,
      jsonBodyLimit: value.JSON_BODY_LIMIT,
      urlencodedBodyLimit: value.URLENCODED_BODY_LIMIT,
      rateLimitWindowMs: value.RATE_LIMIT_WINDOW_MS,
      rateLimitMax: value.RATE_LIMIT_MAX,
    },
    auth: {
      accessTokenSecret: value.JWT_ACCESS_SECRET,
      accessTokenTtlSeconds: value.JWT_ACCESS_TTL_SECONDS,
      refreshTokenTtlSeconds: value.REFRESH_TOKEN_TTL_SECONDS,
      issuer: value.JWT_ISSUER || undefined,
      audience: value.JWT_AUDIENCE || undefined,
      refreshCookieName: value.REFRESH_COOKIE_NAME,
      refreshCookieDomain: value.REFRESH_COOKIE_DOMAIN || undefined,
    },
    database: {
      enabled: value.DATABASE_ENABLED,
      url: value.DATABASE_URL || undefined,
      provider: 'postgresql',
    },
    otp: {
      mode: value.OTP_MODE,
      testCode: value.OTP_TEST_CODE,
      ttlSeconds: value.OTP_TTL_SECONDS,
      maxAttempts: value.OTP_MAX_ATTEMPTS,
    },
    whatsapp: {
      apiBaseUrl: value.WHATSAPP_API_BASE_URL,
      apiVersion: value.WHATSAPP_API_VERSION,
      accessToken: value.WHATSAPP_ACCESS_TOKEN || undefined,
      phoneNumberId: value.WHATSAPP_PHONE_NUMBER_ID || undefined,
      otpTemplateName: value.WHATSAPP_OTP_TEMPLATE_NAME || undefined,
      otpTemplateLanguage: value.WHATSAPP_OTP_TEMPLATE_LANGUAGE || undefined,
    },
    phonepe: {
      clientId: value.PHONEPE_CLIENT_ID || undefined,
      clientSecret: value.PHONEPE_CLIENT_SECRET || undefined,
      clientVersion: value.PHONEPE_CLIENT_VERSION,
      merchantId: value.PHONEPE_MERCHANT_ID || undefined,
      env: value.PHONEPE_ENV,
      webhookUsername: value.PHONEPE_WEBHOOK_USERNAME || undefined,
      webhookPassword: value.PHONEPE_WEBHOOK_PASSWORD || undefined,
    },
    bookings: {
      taxRate: value.BOOKING_TAX_RATE,
    },
    scheduler: {
      intervalMs: value.SCHEDULER_INTERVAL_MS,
      disabled: value.DISABLE_INTERNAL_SCHEDULER,
    },
    frontendBaseUrl: value.FRONTEND_BASE_URL,
    backendBaseUrl: value.BACKEND_BASE_URL,
  };

  return deepMerge(config, overrides);
};

export default buildConfig();
