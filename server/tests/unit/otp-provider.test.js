import assert from 'node:assert/strict';
import test from 'node:test';

import { buildConfig } from '../../src/config/env.js';
import { createOtpProvider } from '../../src/modules/auth/otp.provider.js';

test('buildConfig exposes only the frontend origin for browser payment returns', () => {
  const config = buildConfig();

  assert.equal(config.frontendBaseUrl, process.env.FRONTEND_BASE_URL || 'http://localhost:3000');
  assert.equal(Object.hasOwn(config, 'backendBaseUrl'), false);
});

test('buildConfig requires WhatsApp template settings for production OTP mode', () => {
  const originalEnv = { ...process.env };
  process.env = {
    ...originalEnv,
    NODE_ENV: 'production',
    CORS_CREDENTIALS: 'true',
    JWT_ACCESS_SECRET: 'production-access-secret-with-enough-length',
    DATABASE_ENABLED: 'true',
    DATABASE_URL: 'postgresql://postgres:password@example.com:5432/postgres',
    OTP_MODE: 'production',
    WHATSAPP_ACCESS_TOKEN: 'token',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
    WHATSAPP_OTP_TEMPLATE_NAME: '',
    WHATSAPP_OTP_TEMPLATE_LANGUAGE: '',
    ALLOWED_ORIGINS: 'https://example.com',
  };

  assert.throws(
    () => buildConfig(),
    /WhatsApp OTP template settings must be set/,
  );

  process.env = originalEnv;
});

test('production OTP provider sends configured WhatsApp template payload', async () => {
  let request;
  const provider = createOtpProvider({
    config: {
      otp: { mode: 'production' },
      whatsapp: {
        apiBaseUrl: 'https://graph.example.test',
        apiVersion: 'v99.0',
        phoneNumberId: 'phone-id',
        accessToken: 'token',
        otpTemplateName: 'custom_otp',
        otpTemplateLanguage: 'en_US',
      },
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  });

  await provider.sendOtp({ phone: '+919876543210', code: '654321' });

  assert.equal(request.url, 'https://graph.example.test/v99.0/phone-id/messages');
  assert.equal(request.options.headers.Authorization, 'Bearer token');
  const body = JSON.parse(request.options.body);
  assert.equal(body.to, '919876543210');
  assert.equal(body.template.name, 'custom_otp');
  assert.equal(body.template.language.code, 'en_US');
});
