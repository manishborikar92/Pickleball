export const createOpenApiSpec = ({ config } = {}) => {
  const apiPrefix = config?.app?.apiPrefix || '/api/v1';

  return {
    openapi: '3.0.3',
    info: {
      title: 'Pickleball Platform API',
      version: '1.0.0',
      description: 'Versioned API for booking, authentication, onboarding, and operations.',
    },
    servers: [
      { url: '/' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        refreshCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: config?.auth?.refreshCookieName || 'pb_refresh_token',
        },
      },
      schemas: {
        ApiSuccess: {
          type: 'object',
          required: ['success', 'message', 'data'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { type: 'object' },
          },
        },
        ApiError: {
          type: 'object',
          required: ['success', 'message', 'data'],
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    paths: {
      '/': {
        get: {
          tags: ['Meta'],
          summary: 'API root metadata',
          responses: { 200: { description: 'API metadata' } },
        },
      },
      [`${apiPrefix}/health`]: {
        get: {
          tags: ['Health'],
          summary: 'Service health',
          responses: { 200: { description: 'Healthy' } },
        },
      },
      [`${apiPrefix}/live`]: {
        get: {
          tags: ['Health'],
          summary: 'Liveness probe',
          responses: { 200: { description: 'Process is alive' } },
        },
      },
      [`${apiPrefix}/ready`]: {
        get: {
          tags: ['Health'],
          summary: 'Readiness probe',
          responses: {
            200: { description: 'Ready to serve traffic' },
            503: { description: 'Not ready' },
          },
        },
      },
      [`${apiPrefix}/auth/otp/send`]: {
        post: {
          tags: ['Auth'],
          summary: 'Send customer OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: { phone: { type: 'string', example: '+919876543210' } },
                },
              },
            },
          },
          responses: { 200: { description: 'OTP sent' }, 400: { description: 'Invalid phone' } },
        },
      },
      [`${apiPrefix}/auth/otp/verify`]: {
        post: {
          tags: ['Auth'],
          summary: 'Verify customer OTP and create session',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone', 'otp'],
                  properties: {
                    phone: { type: 'string', example: '+919876543210' },
                    otp: { type: 'string', example: '123456' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Session created' }, 400: { description: 'Invalid OTP' } },
        },
      },
      [`${apiPrefix}/auth/staff/login`]: {
        post: {
          tags: ['Auth'],
          summary: 'Login staff user and create session',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email', example: 'admin@baselinearena.in' },
                    password: { type: 'string', format: 'password', example: 'SecurePass123!' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Staff session created' },
            401: { description: 'Invalid credentials' },
            403: { description: 'Account unavailable' },
            423: { description: 'Account locked' },
          },
        },
      },
      [`${apiPrefix}/auth/refresh`]: {
        post: {
          tags: ['Auth'],
          summary: 'Rotate refresh token and issue a new access token',
          security: [{ refreshCookie: [] }],
          responses: { 200: { description: 'Session refreshed' }, 401: { description: 'Invalid refresh token' } },
        },
      },
      [`${apiPrefix}/auth/logout`]: {
        post: {
          tags: ['Auth'],
          summary: 'Logout current device',
          security: [{ refreshCookie: [] }],
          responses: { 200: { description: 'Logged out' } },
        },
      },
      [`${apiPrefix}/auth/logout-all`]: {
        post: {
          tags: ['Auth'],
          summary: 'Logout all devices',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'All sessions revoked' }, 401: { description: 'Unauthorized' } },
        },
      },
      [`${apiPrefix}/auth/onboarding`]: {
        post: {
          tags: ['Onboarding'],
          summary: 'Complete customer onboarding',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: { name: { type: 'string', example: 'Asha Mehta' } },
                },
              },
            },
          },
          responses: { 200: { description: 'Onboarding completed' }, 401: { description: 'Unauthorized' } },
        },
      },
      [`${apiPrefix}/users/me`]: {
        get: {
          tags: ['Users'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Current user' }, 401: { description: 'Unauthorized' } },
        },
      },
      [`${apiPrefix}/docs/openapi.json`]: {
        get: {
          tags: ['Documentation'],
          summary: 'OpenAPI JSON specification',
          responses: { 200: { description: 'OpenAPI document' } },
        },
      },
      [`${apiPrefix}/docs`]: {
        get: {
          tags: ['Documentation'],
          summary: 'Swagger UI',
          responses: { 200: { description: 'Interactive API documentation' } },
        },
      },
    },
  };
};
