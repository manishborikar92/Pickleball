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
        RewardMechanismConfig: {
          type: 'object',
          required: ['prizes'],
          properties: {
            card_theme: { type: 'string', example: 'court_green' },
            segment_count: { type: 'integer', minimum: 2, maximum: 12, example: 8 },
            prizes: {
              type: 'array',
              minItems: 1,
              maxItems: 20,
              items: {
                type: 'object',
                required: ['id', 'label', 'type', 'probability'],
                properties: {
                  id: { type: 'string', example: 'p1' },
                  label: { type: 'string', example: 'Free Iced Coffee at the Baseline Café' },
                  type: { type: 'string', enum: ['no_prize', 'voucher'] },
                  probability: { type: 'number', example: 0.25 },
                  terms: { type: 'string', maxLength: 500, description: 'Voucher smallprint shown to the customer', example: 'Show this voucher at the café counter. One per visit.' },
                  validity_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Redemption window after reveal (voucher prizes; default 30)', example: 14 },
                },
              },
            },
          },
        },
        RewardMechanismInput: {
          type: 'object',
          required: ['venue_id', 'name', 'type', 'config'],
          properties: {
            venue_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Post-Booking Scratch Card' },
            type: { type: 'string', enum: ['scratch_card'] },
            trigger_event: { type: 'string', enum: ['booking_confirmed'], default: 'booking_confirmed' },
            instance_expiry_days: { type: 'integer', minimum: 1, maximum: 365, default: 7 },
            is_active: { type: 'boolean', default: false },
            valid_from: { type: 'string', format: 'date-time' },
            valid_until: { type: 'string', format: 'date-time' },
            config: { $ref: '#/components/schemas/RewardMechanismConfig' },
          },
        },
        NotificationSettings: {
          type: 'object',
          required: ['venue_id', 'reminders_enabled', 'review_requests_enabled'],
          properties: {
            id: { type: 'string', format: 'uuid', nullable: true },
            venue_id: { type: 'string', format: 'uuid' },
            reminders_enabled: { type: 'boolean', default: false, description: 'T-24h + T-2h WhatsApp reminders before a session' },
            review_requests_enabled: { type: 'boolean', default: false, description: 'Post-session WhatsApp review request linking /review/{bookingId}' },
            updated_at: { type: 'string', format: 'date-time', nullable: true },
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
      [`/auth/admin/login`]: {
        post: {
          tags: ['Auth'],
          summary: 'Login admin user and create session',
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
              description: 'Admin session created successfully',
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
      [`/payments/verify`]: {
        get: {
          tags: ['Payments'],
          summary: 'Verify payment (PhonePe Verify Payment Response step)',
          description: 'Backs the frontend /booking/redirect page — the target of PhonePe merchantUrls.redirectUrl. Verifies the payment with the gateway Order Status API, processes terminal states idempotently, and returns the booking reference as JSON. Returns state UNKNOWN (with the booking reference) when the gateway is unreachable so the frontend can land on the unified booking page.',
          parameters: [
            { name: 'orderId', in: 'query', required: true, schema: { type: 'string', example: 'PP-booking123' } },
          ],
          responses: {
            200: { description: 'Payment verified; booking reference and statuses returned', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'No payment found for the given orderId', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/payments/webhooks/phonepe`]: {
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
      [`/reviews`]: {
        post: {
          tags: ['Reviews'],
          summary: 'Submit a review for a completed booking',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['booking_id', 'rating'],
                  properties: {
                    booking_id: { type: 'string', format: 'uuid', example: '44444444-4444-4444-8444-444444444444' },
                    rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
                    comment: { type: 'string', maxLength: 1000, example: 'Great court, fast surface.' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Review submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            400: { description: 'Booking not completed or invalid payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            404: { description: 'Booking not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            409: { description: 'A review already exists for this booking', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
        get: {
          tags: ['Reviews'],
          summary: 'List published reviews for a venue',
          parameters: [
            { name: 'venue_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          ],
          responses: {
            200: { description: 'Published reviews with rating summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            400: { description: 'Missing or invalid venue_id', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/reviews/me`]: {
        get: {
          tags: ['Reviews'],
          summary: 'Get the authenticated user\'s review for a booking',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'booking_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'The caller\'s review for the booking', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Review not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/reviews/moderation`]: {
        get: {
          tags: ['Reviews'],
          summary: 'List all reviews (published and unpublished) for a managed venue',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'venue_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
            { name: 'is_published', in: 'query', required: false, schema: { type: 'boolean' } },
          ],
          responses: {
            200: { description: 'Moderation view of venue reviews', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            403: { description: 'Missing manage_bookings permission for the venue', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/reviews/{reviewId}`]: {
        patch: {
          tags: ['Reviews'],
          summary: 'Moderate a review (publish or unpublish)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'reviewId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['is_published'],
                  properties: {
                    is_published: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Review moderation state updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Review not found or not manageable by the caller', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/rewards/instances`]: {
        get: {
          tags: ['Rewards'],
          summary: 'List the authenticated user\'s reward instances',
          description: 'The outcome field is omitted for pending instances — it is only returned after reveal.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['pending', 'revealed', 'expired'] } },
          ],
          responses: {
            200: { description: 'The caller\'s reward instances', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
          },
        },
      },
      [`/rewards/instances/moderation`]: {
        get: {
          tags: ['Rewards'],
          summary: 'List reward instances for a managed venue',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'venue_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['pending', 'revealed', 'expired'] } },
            { name: 'mechanism_id', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
            { name: 'voucher_code', in: 'query', required: false, schema: { type: 'string', maxLength: 20 } },
            { name: 'redeemed', in: 'query', required: false, schema: { type: 'boolean' } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          ],
          responses: {
            200: { description: 'Moderation view of venue reward instances', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            403: { description: 'Missing manage_bookings permission for the venue', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/rewards/instances/{instanceId}`]: {
        get: {
          tags: ['Rewards'],
          summary: 'Get a single owned reward instance',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'instanceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'The reward instance (outcome hidden while pending)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Reward not found or not owned by the caller (REWARD_NOT_FOUND)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/rewards/instances/{instanceId}/reveal`]: {
        post: {
          tags: ['Rewards'],
          summary: 'Reveal a pending reward instance',
          description: 'Validates ownership, pending status, and non-expiry. A voucher prize is materialized atomically: a unique voucher code and redemption window are issued in the same transaction. The outcome is returned to the client for the first time.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'instanceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Reward revealed with outcome and voucher detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Reward not found or not owned by the caller (REWARD_NOT_FOUND)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            409: { description: 'Reward already revealed (REWARD_ALREADY_REVEALED)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            410: { description: 'Reward has expired (REWARD_EXPIRED)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/rewards/instances/{instanceId}/expire`]: {
        patch: {
          tags: ['Rewards'],
          summary: 'Manually expire a pending reward instance',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'instanceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Reward expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Reward not found or not manageable by the caller', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            409: { description: 'Reward is not pending', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/rewards/instances/{instanceId}/redeem`]: {
        patch: {
          tags: ['Rewards'],
          summary: 'Mark a revealed voucher as redeemed at the venue stall',
          description: 'Staff-tracked redemption: first redemption wins; repeat attempts return 409 (VOUCHER_ALREADY_REDEEMED). A voucher past its validity window returns 410 (VOUCHER_EXPIRED).',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'instanceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    note: { type: 'string', maxLength: 500, example: 'Redeemed at café counter' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Voucher redeemed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            404: { description: 'Reward not found or not manageable by the caller', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            409: { description: 'Voucher not redeemable or already redeemed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            410: { description: 'Voucher validity period has passed (VOUCHER_EXPIRED)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/rewards/mechanisms`]: {
        get: {
          tags: ['Rewards'],
          summary: 'List a venue\'s reward mechanisms (active and inactive)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'venue_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'The venue\'s reward mechanisms', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            403: { description: 'Missing edit_pricing permission for the venue', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
        post: {
          tags: ['Rewards'],
          summary: 'Create a reward mechanism for a venue',
          description: 'Prize probabilities must sum to exactly 1.0 — validated server-side on save.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RewardMechanismInput' },
              },
            },
          },
          responses: {
            201: { description: 'Reward mechanism created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            400: { description: 'Invalid prize configuration (e.g. probabilities do not sum to 1.0)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            403: { description: 'Missing edit_pricing permission for the venue', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/rewards/mechanisms/{mechanismId}`]: {
        patch: {
          tags: ['Rewards'],
          summary: 'Edit a reward mechanism (name, config, active state, validity window)',
          description: 'Config edits affect only future issuances — existing instances retain their config snapshot.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'mechanismId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', maxLength: 255 },
                    instance_expiry_days: { type: 'integer', minimum: 1, maximum: 365 },
                    is_active: { type: 'boolean' },
                    valid_from: { type: 'string', format: 'date-time', nullable: true },
                    valid_until: { type: 'string', format: 'date-time', nullable: true },
                    config: { $ref: '#/components/schemas/RewardMechanismConfig' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Reward mechanism updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            400: { description: 'Invalid prize configuration', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            404: { description: 'Mechanism not found or not manageable by the caller', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/notifications/settings`]: {
        get: {
          tags: ['Notifications'],
          summary: 'Get a venue notification toggle settings',
          description: 'Returns the venue reminders + review-request toggles. Defaults to both off when no row exists yet.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'venue_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: { description: 'Notification settings', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: 'object', properties: { data: { $ref: '#/components/schemas/NotificationSettings' } } }] } } } },
            403: { description: 'Missing manage_venues permission for the venue', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
        patch: {
          tags: ['Notifications'],
          summary: 'Update a venue notification toggle settings',
          description: 'Upserts the venue reminders + review-request toggles. At least one toggle must be provided. Delivery stays dry-run until Meta WhatsApp is configured (NOTIFICATIONS_TRANSPORT_MODE=live).',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['venue_id'],
                  properties: {
                    venue_id: { type: 'string', format: 'uuid' },
                    reminders_enabled: { type: 'boolean', example: true },
                    review_requests_enabled: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Notification settings updated', content: { 'application/json': { schema: { allOf: [{ $ref: '#/components/schemas/ApiSuccess' }, { type: 'object', properties: { data: { $ref: '#/components/schemas/NotificationSettings' } } }] } } } },
            400: { description: 'No toggle provided or invalid payload', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            403: { description: 'Missing manage_venues permission for the venue', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      [`/notifications/log`]: {
        get: {
          tags: ['Notifications'],
          summary: 'Paginated notification dispatch log for a venue',
          description: 'Observability surface for scheduled notification delivery (sent/failed/cancelled/skipped) with per-status summary counts.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'venue_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['scheduled', 'sending', 'sent', 'failed', 'cancelled', 'skipped'] } },
            { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['reminder_t24', 'reminder_t2h', 'review_request'] } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          ],
          responses: {
            200: { description: 'Notification dispatch log with status summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } } } },
            403: { description: 'Missing manage_bookings permission for the venue', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
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
