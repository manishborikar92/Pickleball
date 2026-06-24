import assert from 'node:assert/strict';
import test from 'node:test';

import { createPaymentProviderFromEnv } from '../../src/modules/payments/provider-factory.js';

test('provider factory returns sandbox provider when env is test', () => {
  const provider = createPaymentProviderFromEnv({
    env: 'test',
    isTest: true,
    app: { port: 5000 },
  });

  assert.equal(provider.name, 'sandbox');
  assert.equal(typeof provider.createPaymentOrder, 'function');
  assert.equal(typeof provider.getPaymentStatus, 'function');
  assert.equal(typeof provider.refundPayment, 'function');
});

test('provider factory returns phonepe provider when env is not test', () => {
  const provider = createPaymentProviderFromEnv({
    env: 'development',
    isTest: false,
    phonepe: {
      clientId: 'test-id',
      clientSecret: 'test-secret',
      clientVersion: 1,
      merchantId: 'M123',
      env: 'SANDBOX',
    },
    backendBaseUrl: 'http://localhost:5000',
  });

  assert.equal(provider.name, 'phonepe');
  assert.equal(typeof provider.createPaymentOrder, 'function');
  assert.equal(typeof provider.getPaymentStatus, 'function');
  assert.equal(typeof provider.refundPayment, 'function');
});

test('provider factory defaults to sandbox for isTest=true flag', () => {
  const provider = createPaymentProviderFromEnv({
    isTest: true,
  });

  assert.equal(provider.name, 'sandbox');
});
