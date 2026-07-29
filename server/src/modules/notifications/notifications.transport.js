import { InternalServerError } from '../../utils/api-error.js';
import defaultLogger from '../../utils/logger.js';
import {
  DEFAULT_TEMPLATE_LANGUAGE,
  NotificationType,
  TEMPLATE_CONFIG_KEY,
  TRANSPORT_PROVIDER,
} from './notifications.constants.js';

/**
 * WhatsApp Cloud API transport for scheduled notifications — the abstraction
 * that lets scheduling/dispatch logic run end-to-end BEFORE Meta is configured.
 *
 * Generalizes the OTP provider pattern (`server/src/modules/auth/otp.provider.js`):
 * a factory-created, config-driven, `fetchImpl`-injectable transport that no-ops
 * (dry-run) until Meta credentials + approved templates are in place, then POSTs
 * utility template messages to the Graph API. Scheduling and business logic
 * never call this directly at schedule time — only the dispatcher calls it.
 *
 * See docs/adrs/ADR-011-notifications-module.md and
 * docs/integrations/01-WHATSAPP-INTEGRATION.md.
 *
 * @param {{ config: object, fetchImpl?: Function, logger?: object }} deps
 * @returns {{ isConfigured(): boolean, mode(): string, send(args: { to: string, type: string, components?: object[], params?: Record<string,string> }): Promise<{provider: string, delivered: boolean}> }}
 */
export const createNotificationTransport = ({
  config,
  fetchImpl = fetch,
  logger = defaultLogger,
} = {}) => {
  const notifications = config?.notifications ?? {};

  /** The transport mode resolved from config: 'dry_run' (default) or 'live'. */
  const mode = () => notifications.transportMode || 'dry_run';

  /** Live mode needs the WhatsApp credentials AND the template for this type. */
  const templateFor = (type) => {
    const key = TEMPLATE_CONFIG_KEY[type];
    if (!key) return null;
    return notifications[key] ?? null;
  };

  const isConfigured = () => {
    if (mode() !== 'live') return false;
    const whatsapp = config?.whatsapp ?? {};
    if (!whatsapp.phoneNumberId || !whatsapp.accessToken) return false;
    return Object.values(NotificationType).every((type) => {
      const tpl = templateFor(type);
      return tpl?.name;
    });
  };

  /**
   * Sends (or dry-runs) a notification template message.
   *
   * @param {object} args
   * @param {string} args.to - E.164 phone (leading + stripped for the API).
   * @param {string} args.type - One of NotificationType.
   * @param {object[]} [args.components] - Pre-built template components (body/buttons).
   * @param {Record<string,string>} [args.params] - Optional body parameters; when
   *   `components` is omitted, a single body component is built from these.
   * @returns {Promise<{provider: string, delivered: boolean}>}
   *   In dry-run mode, resolves `{ provider: 'dry_run', delivered: true }` without
   *   any network call — the dispatch pipeline still completes and is observable.
   * @throws {InternalServerError} in live mode on a non-2xx Meta response.
   */
  async function send({ to, type, components, params }) {
    if (mode() !== 'live') {
      logger.info('Notification dry-run (Meta not configured)', {
        operation: 'notifications:transport:dry-run',
        type,
        to,
      });
      return { provider: TRANSPORT_PROVIDER.DRY_RUN, delivered: true };
    }

    const whatsapp = config?.whatsapp ?? {};
    const phoneNumberId = whatsapp.phoneNumberId;
    const accessToken = whatsapp.accessToken;
    const template = templateFor(type);
    if (!phoneNumberId || !accessToken || !template?.name) {
      throw new InternalServerError('Notification transport is not configured for live delivery');
    }

    const apiBaseUrl = whatsapp.apiBaseUrl || 'https://graph.facebook.com';
    const apiVersion = whatsapp.apiVersion || 'v20.0';
    const bodyComponents = components ?? [
      {
        type: 'body',
        parameters: Object.values(params ?? {}).map((text) => ({ type: 'text', text })),
      },
    ];

    const response = await fetchImpl(`${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: String(to).replace(/^\+/, ''),
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language || DEFAULT_TEMPLATE_LANGUAGE },
          components: bodyComponents,
        },
      }),
    });

    if (!response.ok) {
      throw new InternalServerError('WhatsApp notification delivery failed');
    }

    return { provider: TRANSPORT_PROVIDER.WHATSAPP, delivered: true };
  }

  return { isConfigured, mode, send };
};
