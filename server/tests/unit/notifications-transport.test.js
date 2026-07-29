import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotificationTransport } from '../../src/modules/notifications/notifications.transport.js';
import { NotificationType } from '../../src/modules/notifications/notifications.constants.js';

const baseConfig = {
  whatsapp: {
    apiBaseUrl: 'https://graph.example.test',
    apiVersion: 'v99.0',
    phoneNumberId: 'phone-id',
    accessToken: 'token',
  },
  notifications: {
    transportMode: 'dry_run',
    reminderT24Template: { name: 'reminder_t24', language: 'en_US' },
    reminderT2hTemplate: { name: 'reminder_t2h', language: 'en_US' },
    reviewTemplate: { name: 'review_request', language: 'en_US' },
  },
};

test('dry-run mode returns delivered without calling fetch', async () => {
  let fetched = false;
  const transport = createNotificationTransport({
    config: baseConfig,
    fetchImpl: async () => { fetched = true; return { ok: true }; },
  });

  const result = await transport.send({ to: '+919876543210', type: NotificationType.REMINDER_T24 });

  assert.equal(result.provider, 'dry_run');
  assert.equal(result.delivered, true);
  assert.equal(fetched, false);
  assert.equal(transport.mode(), 'dry_run');
  assert.equal(transport.isConfigured(), false);
});

test('live mode sends the configured template payload to the Graph API', async () => {
  let request;
  const transport = createNotificationTransport({
    config: { ...baseConfig, notifications: { ...baseConfig.notifications, transportMode: 'live' } },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  });

  const result = await transport.send({
    to: '+919876543210',
    type: NotificationType.REVIEW_REQUEST,
    params: { link: 'https://app.example.test/review/abc-123' },
  });

  assert.equal(result.provider, 'whatsapp');
  assert.equal(result.delivered, true);
  assert.equal(request.url, 'https://graph.example.test/v99.0/phone-id/messages');
  assert.equal(request.options.headers.Authorization, 'Bearer token');
  const body = JSON.parse(request.options.body);
  assert.equal(body.to, '919876543210');
  assert.equal(body.template.name, 'review_request');
  assert.equal(body.template.language.code, 'en_US');
  assert.equal(body.template.components[0].type, 'body');
  assert.equal(body.template.components[0].parameters[0].text, 'https://app.example.test/review/abc-123');
});

test('live mode is configured only when creds and all three templates are present', () => {
  const live = { ...baseConfig, notifications: { ...baseConfig.notifications, transportMode: 'live' } };
  assert.equal(createNotificationTransport({ config: live }).isConfigured(), true);

  const missingTemplate = {
    ...live,
    notifications: { ...live.notifications, reviewTemplate: { name: '', language: 'en_US' } },
  };
  assert.equal(createNotificationTransport({ config: missingTemplate }).isConfigured(), false);

  const missingCreds = { ...live, whatsapp: { ...live.whatsapp, accessToken: undefined } };
  assert.equal(createNotificationTransport({ config: missingCreds }).isConfigured(), false);
});

test('live mode throws when not configured for the requested type', async () => {
  const config = {
    ...baseConfig,
    notifications: { ...baseConfig.notifications, transportMode: 'live', reminderT24Template: { name: '', language: 'en_US' } },
  };
  const transport = createNotificationTransport({ config });

  await assert.rejects(
    transport.send({ to: '+919876543210', type: NotificationType.REMINDER_T24 }),
    /not configured/,
  );
});

test('live mode throws on a non-2xx Meta response', async () => {
  const transport = createNotificationTransport({
    config: { ...baseConfig, notifications: { ...baseConfig.notifications, transportMode: 'live' } },
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });

  await assert.rejects(
    transport.send({ to: '+919876543210', type: NotificationType.REMINDER_T24 }),
    /delivery failed/,
  );
});
