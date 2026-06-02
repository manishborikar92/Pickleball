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
            message: { type: 'string', example: 'Error message details' },
            data: { type: 'object' },
          },
        },
        OtpSendResponse: {
          type: 'object',
          required: ['phone', 'expires_in_seconds'],
          properties: {
            phone: { type: 'string', example: '+919876543210' },
            expires_in_seconds: { type: 'integer', example: 300 },
            sandbox_otp: { type: 'string', example: '123456' },
          },
        },
        AuthResponse: {
          type: 'object',
          required: ['access_token', 'expires_in', 'user'],
          properties: {
            access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
            expires_in: { type: 'integer', example: 900 },
            user: {
              type: 'object',
              required: ['id', 'phone', 'onboarding_complete'],
              properties: {
                id: { type: 'string', example: 'user-1' },
                phone: { type: 'string', example: '+919876543210' },
                email: { type: 'string', format: 'email', example: 'manager@besanagpur.com' },
                name: { type: 'string', example: 'Ravi Kumar' },
                onboarding_complete: { type: 'boolean', example: true },
              },
            },
            next_step: { type: 'string', example: 'admin_dashboard' },
          },
        },
        UserProfile: {
          type: 'object',
          required: ['id', 'phone', 'name', 'onboarding_complete', 'roles', 'permissions'],
          properties: {
            id: { type: 'string', example: 'user-1' },
            phone: { type: 'string', example: '+919876543210' },
            name: { type: 'string', example: 'Asha Mehta' },
            onboarding_complete: { type: 'boolean', example: true },
            roles: {
              type: 'array',
              items: {
                type: 'object',
                required: ['venue_id', 'role'],
                properties: {
                  venue_id: { type: 'string', example: 'venue-1' },
                  venue_name: { type: 'string', example: 'Baseline Arena Besa' },
                  role: { type: 'string', example: 'manager' },
                },
              },
            },
            permissions: {
              type: 'array',
              items: { type: 'string', example: 'view_own_bookings' },
            },
          },
        },
      },
    },
    paths: {
      '/': {
        get: {
          tags: ['Meta'],
          summary: 'API root metadata',
          responses: {
            200: {
              description: 'API metadata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Enterprise Express API' },
                      data: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/health`]: {
        get: {
          tags: ['Health'],
          summary: 'Service health',
          responses: {
            200: {
              description: 'Healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Health checks passed' },
                      data: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/live`]: {
        get: {
          tags: ['Health'],
          summary: 'Liveness probe',
          responses: {
            200: {
              description: 'Process is alive',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Alive' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/ready`]: {
        get: {
          tags: ['Health'],
          summary: 'Readiness probe',
          responses: {
            200: {
              description: 'Ready to serve traffic',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Ready' },
                    },
                  },
                },
              },
            },
            503: {
              description: 'Not ready',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError',
                  },
                },
              },
            },
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
          responses: {
            200: {
              description: 'OTP sent successfully',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccess' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/OtpSendResponse' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: {
              description: 'Invalid phone or bad request',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
          },
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
          responses: {
            200: {
              description: 'Session created successfully',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccess' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/AuthResponse' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: {
              description: 'Invalid OTP or parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
          },
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
            200: {
              description: 'Staff session created successfully',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccess' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/AuthResponse' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
            403: {
              description: 'Account suspended or not activated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
            423: {
              description: 'Account locked due to consecutive failures',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/auth/refresh`]: {
        post: {
          tags: ['Auth'],
          summary: 'Rotate refresh token and issue a new access token',
          security: [{ refreshCookie: [] }],
          responses: {
            200: {
              description: 'Session refreshed successfully',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccess' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/AuthResponse' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            401: {
              description: 'Invalid refresh token or cookie',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/auth/logout`]: {
        post: {
          tags: ['Auth'],
          summary: 'Logout current device',
          security: [{ refreshCookie: [] }],
          responses: {
            200: {
              description: 'Logged out successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiSuccess' },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/auth/logout-all`]: {
        post: {
          tags: ['Auth'],
          summary: 'Logout all devices',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'All sessions revoked successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiSuccess' },
                },
              },
            },
            401: {
              description: 'Unauthorized access',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
          },
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
          responses: {
            200: {
              description: 'Onboarding completed successfully',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccess' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/AuthResponse' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized access',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/users/me`]: {
        get: {
          tags: ['Users'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Current user profile fetched successfully',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiSuccess' },
                      {
                        type: 'object',
                        properties: {
                          data: { $ref: '#/components/schemas/UserProfile' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized access',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
          },
        },
      },
      [`${apiPrefix}/docs/openapi.json`]: {
        get: {
          tags: ['Documentation'],
          summary: 'OpenAPI JSON specification',
          responses: {
            200: {
              description: 'OpenAPI specification document',
            },
          },
        },
      },
      [`${apiPrefix}/docs`]: {
        get: {
          tags: ['Documentation'],
          summary: 'Swagger UI',
          responses: {
            200: {
              description: 'Interactive API documentation page',
            },
          },
        },
      },
    },
  };
};
