import { InternalServerError } from '../../utils/api-error.js';

export const createOtpProvider = ({ config, fetchImpl = fetch } = {}) => ({
  async sendOtp({ phone, code }) {
    if (config.otp.mode !== 'production') {
      return {
        provider: config.otp.mode,
        delivered: true,
      };
    }

    const phoneNumberId = config.whatsapp.phoneNumberId;
    const accessToken = config.whatsapp.accessToken;
    const templateName = config.whatsapp.otpTemplateName;
    const templateLanguage = config.whatsapp.otpTemplateLanguage;
    if (!phoneNumberId || !accessToken || !templateName || !templateLanguage) {
      throw new InternalServerError('WhatsApp OTP provider is not configured');
    }

    const apiBaseUrl = config.whatsapp.apiBaseUrl || 'https://graph.facebook.com';
    const apiVersion = config.whatsapp.apiVersion || 'v20.0';
    const response = await fetchImpl(`${apiBaseUrl}/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: code }],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new InternalServerError('WhatsApp OTP delivery failed');
    }

    return {
      provider: 'whatsapp',
      delivered: true,
    };
  },
});
