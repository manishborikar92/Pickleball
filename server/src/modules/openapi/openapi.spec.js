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
      { url: apiPrefix },
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
      [`/health`]: {
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
      [`/live`]: {
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
      [`/ready`]: {
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
      [`/auth/otp/send`]: {
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
      [`/auth/otp/verify`]: {
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
      [`/auth/staff/login`]: {
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
      [`/auth/refresh`]: {
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
      [`/auth/logout`]: {
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
      [`/auth/logout-all`]: {
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
      [`/auth/onboarding`]: {
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
      [`/users/me`]: {
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
      [`/users/me/bookings`]: {
        get: {
          tags: ['Users'],
          summary: 'List current user bookings',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending_payment', 'confirmed', 'completed', 'expired', 'cancelled'] } },
            { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          ],
          responses: {
            200: {
              description: 'Owner-scoped booking history',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } },
            },
            401: { description: 'Unauthorized access', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/users/me/wallet`]: {
        get: {
          tags: ['Users'],
          summary: 'Get wallet balance and transactions',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Wallet balance and transaction history',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } },
            },
            401: { description: 'Unauthorized access', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/venues/{venueId}`]: {
        get: {
          tags: ['Venues'],
          summary: 'Get venue by ID',
          parameters: [
            { name: 'venueId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Venue details', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Venue not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/venues/slug/{slug}`]: {
        get: {
          tags: ['Venues'],
          summary: 'Get venue by slug',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string', example: 'besa-nagpur' } },
          ],
          responses: {
            200: { description: 'Venue details', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Venue not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/venues/{venueId}/availability`]: {
        get: {
          tags: ['Venues'],
          summary: 'Get venue court availability for a date',
          parameters: [
            { name: 'venueId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date', example: '2026-06-18' } },
          ],
          responses: {
            200: { description: 'Generated availability with server prices', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            400: { description: 'Invalid date or outside booking window', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/bookings/price-preview`]: {
        post: {
          tags: ['Bookings'],
          summary: 'Preview authoritative booking price',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['venue_id', 'court_ids', 'slot_date', 'slot_start_times'],
                  properties: {
                    venue_id: { type: 'string', format: 'uuid', example: '11111111-1111-4111-8111-111111111111' },
                    court_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
                    slot_date: { type: 'string', format: 'date', example: '2026-06-18' },
                    slot_start_times: { type: 'array', items: { type: 'string', example: '09:00' } },
                    coupon_code: { type: 'string', example: 'FIRST10' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Authoritative quote', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            400: { description: 'Invalid selection', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/bookings/hold`]: {
        post: {
          tags: ['Bookings'],
          summary: 'Create an atomic pending booking hold',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['venue_id', 'court_ids', 'slot_date', 'slot_start_times'],
                  properties: {
                    venue_id: { type: 'string', format: 'uuid', example: '11111111-1111-4111-8111-111111111111' },
                    court_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
                    slot_date: { type: 'string', format: 'date', example: '2026-06-18' },
                    slot_start_times: { type: 'array', items: { type: 'string', example: '09:00' } },
                    coupon_code: { type: 'string', example: 'FIRST10' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Hold created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            409: { description: 'Slot conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            429: { description: 'Active hold limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/bookings/{bookingId}`]: {
        get: {
          tags: ['Bookings'],
          summary: 'Get an owner-scoped booking',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'bookingId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Booking details', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Booking not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/bookings/{bookingId}/waiver`]: {
        post: {
          tags: ['Bookings'],
          summary: 'Record liability waiver acceptance',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'bookingId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['time_acknowledged', 'policy_accepted'],
                  properties: {
                    time_acknowledged: { type: 'boolean', example: true },
                    policy_accepted: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Waiver accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            400: { description: 'Waiver fields must both be true', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/bookings/{bookingId}/initiate-payment`]: {
        post: {
          tags: ['Bookings'],
          summary: 'Initiate wallet or sandbox payment for a held booking',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'bookingId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    use_wallet_credits: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Payment initiated or booking confirmed by wallet', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            410: { description: 'Booking hold expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            422: { description: 'Waiver required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/payments/status/{merchantOrderId}`]: {
        get: {
          tags: ['Payments'],
          summary: 'Get payment status',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'merchantOrderId', in: 'path', required: true, schema: { type: 'string', example: 'SANDBOX-order-1' } },
          ],
          responses: {
            200: { description: 'Payment status', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Payment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/payments/redirect`]: {
        get: {
          tags: ['Payments'],
          summary: 'PhonePe payment redirect handler',
          description: 'Handles browser redirect from PhonePe payment gateway, verifies payment state, and redirects the browser to the appropriate frontend page.',
          parameters: [
            { name: 'orderId', in: 'query', required: true, schema: { type: 'string', example: 'PP-booking123' } },
          ],
          responses: {
            302: { description: 'Redirects to confirmed, failed, or pending page on frontend' },
          },
        },
      },
      [`/webhooks/phonepe`]: {
        post: {
          tags: ['Payments'],
          summary: 'PhonePe webhook callback receiver',
          description: 'Receives server-to-server transaction status callbacks from PhonePe. Authenticates messages via basic authentication credentials.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    response: { type: 'string', description: 'Base64 encoded payload from PhonePe containing payment details' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Webhook acknowledged and processed successfully' },
            401: { description: 'Unauthorized signature or credentials' },
          },
        },
      },
      [`/payments/{paymentId}/refund`]: {
        post: {
          tags: ['Payments'],
          summary: 'Initiate a refund for a payment',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid', example: 'e3f01901-cc0a-4fb4-9c4c-4e89791448b1' } },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number', example: 500.00 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Refund initiated successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Payment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            409: { description: 'Invalid payment state for refund', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/payments/{paymentId}/refund/retry`]: {
        post: {
          tags: ['Payments'],
          summary: 'Retry a failed refund',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid', example: 'e3f01901-cc0a-4fb4-9c4c-4e89791448b1' } },
          ],
          responses: {
            200: { description: 'Refund retry initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Payment not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            409: { description: 'Invalid payment state for retry', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/docs/openapi.json`]: {
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
      [`/docs`]: {
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
