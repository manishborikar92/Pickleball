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
  JWT_REFRESH_SECRET: Joi.string().min(24).default('development-refresh-secret-change-before-production'),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(15 * 60),
  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().positive().default(30 * 24 * 60 * 60),
  JWT_ISSUER: Joi.string().allow('').default(''),
  JWT_AUDIENCE: Joi.string().allow('').default(''),
  REFRESH_COOKIE_NAME: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).default('pb_refresh_token'),
  REFRESH_COOKIE_DOMAIN: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).allow('').default(''),
  DATABASE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OTP_MODE: Joi.string().valid('sandbox', 'test', 'production').default('sandbox'),
  OTP_TEST_CODE: Joi.string().pattern(/^\d{6}$/).default('123456'),
  OTP_TTL_SECONDS: Joi.number().integer().positive().default(5 * 60),
  WHATSAPP_API_BASE_URL: Joi.string().uri().default('https://graph.facebook.com'),
  WHATSAPP_API_VERSION: Joi.string().pattern(/^v\d+\.\d+$/).default('v20.0'),
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').default(''),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').default(''),
  WHATSAPP_OTP_TEMPLATE_NAME: Joi.string().allow('').default(''),
  WHATSAPP_OTP_TEMPLATE_LANGUAGE: Joi.string().allow('').default('en_US'),
  SHUTDOWN_TIMEOUT_MS: Joi.number().integer().positive().default(10000),
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

  if (value.NODE_ENV === 'production') {
    if (value.JWT_ACCESS_SECRET === 'development-access-secret-change-before-production') {
      throw new Error('JWT_ACCESS_SECRET must be set in production');
    }

    if (value.JWT_REFRESH_SECRET === 'development-refresh-secret-change-before-production') {
      throw new Error('JWT_REFRESH_SECRET must be set in production');
    }

    if (value.DATABASE_ENABLED && !value.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set when DATABASE_ENABLED=true in production');
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
      refreshTokenSecret: value.JWT_REFRESH_SECRET,
      accessTokenTtlSeconds: value.JWT_ACCESS_TTL_SECONDS,
      refreshTokenTtlSeconds: value.JWT_REFRESH_TTL_SECONDS,
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
    },
    whatsapp: {
      apiBaseUrl: value.WHATSAPP_API_BASE_URL,
      apiVersion: value.WHATSAPP_API_VERSION,
      accessToken: value.WHATSAPP_ACCESS_TOKEN || undefined,
      phoneNumberId: value.WHATSAPP_PHONE_NUMBER_ID || undefined,
      otpTemplateName: value.WHATSAPP_OTP_TEMPLATE_NAME || undefined,
      otpTemplateLanguage: value.WHATSAPP_OTP_TEMPLATE_LANGUAGE || undefined,
    },
  };

  return deepMerge(config, overrides);
};

export default buildConfig();
