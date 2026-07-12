#!/usr/bin/env node

/**
 * Promo Code (Coupon) Creation Tool.
 *
 * Creates a single `coupons` record, applying the same validation and business
 * rules the platform enforces when a coupon is redeemed at checkout. This is a
 * self-contained provisioning script in the style of `prisma/seed.mjs`: it talks
 * to Prisma directly and reuses the shared platform utilities (config-backed
 * client, structured logger, AppError). No coupon HTTP service exists yet, so
 * there is nothing to delegate to — when admin coupon management is built as an
 * API it should live with the other pricing logic in the venues module, and this
 * script would then become a thin client of that service.
 *
 * Usage:
 *   node scripts/create-promo-code.mjs --code=WELCOME10 --type=percentage --value=10
 *   npm run promo:create -- --code=FLAT150 --type=flat --value=150 --max-uses-total=500
 *
 * Required:
 *   --code=<CODE>               3-50 chars, A-Z 0-9 _ - (normalized to UPPERCASE).
 *   --type=<flat|percentage>    Discount type.
 *   --value=<number>            Discount amount. percentage: 0 < v <= 100; flat: v > 0.
 *
 * Optional:
 *   --venue=<uuid>              Restrict to one venue (default: platform-wide).
 *   --max-uses-total=<int>      Global redemption cap (default: unlimited).
 *   --max-uses-per-phone=<int>  Per-phone redemption cap (default: 1).
 *   --valid-from=<ISO>          Activation timestamp, ISO 8601 (default: immediately).
 *   --valid-until=<ISO>         Expiry timestamp, ISO 8601 (default: never).
 *   --inactive                  Create the coupon deactivated (default: active).
 *   --json                      Print the created coupon as JSON to stdout.
 *   --help, -h                  Show this help message.
 *
 * Exit codes: 0 on success, 1 on validation / duplicate / database failure.
 *
 * @see docs/specs/01-DATABASE-SCHEMA.md — `coupons`
 * @see docs/product/02-BUSINESS-LOGIC.md §Coupon Application
 */

import { DiscountType, Prisma } from '@prisma/client';
import Joi from 'joi';

import { disconnectPrisma, getPrisma } from '../src/lib/prisma.js';
import { AppError } from '../src/utils/api-error.js';
import logger from '../src/utils/logger.js';

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

// Discount types come straight from the Prisma enum so the script cannot drift
// from the database schema.
const DISCOUNT_TYPES = Object.values(DiscountType);

// Codes share the exact shape the booking hold validator accepts for
// `coupon_code`, guaranteeing a created code is redeemable at checkout.
const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,50}$/;

// Percentage is a business bound; the flat/int/smallint ceilings match the
// underlying column widths so we fail fast with a clear message instead of a
// raw database overflow error.
const MAX_PERCENTAGE_DISCOUNT = 100;
const MAX_FLAT_DISCOUNT = 99999999.99; // NUMERIC(10,2)
const MAX_USES_TOTAL = 2147483647; // INTEGER
const MAX_USES_PER_PHONE = 32767; // SMALLINT
const DEFAULT_MAX_USES_PER_PHONE = 1;

// ---------------------------------------------------------------------------
// Validation contract (snake_case, mirroring the platform's Joi conventions)
// ---------------------------------------------------------------------------

const couponSchema = Joi.object({
  code: Joi.string()
    .trim()
    .uppercase()
    .pattern(COUPON_CODE_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'code must be 3-50 characters using only A-Z, 0-9, underscore, or hyphen',
    }),
  discount_type: Joi.string()
    .valid(...DISCOUNT_TYPES)
    .required(),
  discount_value: Joi.number()
    .positive()
    .precision(2)
    .when('discount_type', {
      is: DiscountType.percentage,
      then: Joi.number().max(MAX_PERCENTAGE_DISCOUNT).messages({
        'number.max': `discount_value must be between 0 and ${MAX_PERCENTAGE_DISCOUNT} for percentage coupons`,
      }),
      otherwise: Joi.number().max(MAX_FLAT_DISCOUNT),
    })
    .required(),
  venue_id: Joi.string().guid({ version: ['uuidv4'] }).optional(),
  max_uses_total: Joi.number().integer().positive().max(MAX_USES_TOTAL).optional(),
  max_uses_per_phone: Joi.number()
    .integer()
    .positive()
    .max(MAX_USES_PER_PHONE)
    .default(DEFAULT_MAX_USES_PER_PHONE),
  valid_from: Joi.date().iso().optional(),
  valid_until: Joi.date()
    .iso()
    .when('valid_from', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('valid_from')).messages({
        'date.greater': 'valid_until must be later than valid_from',
      }),
    })
    .optional(),
  is_active: Joi.boolean().default(true),
});

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const FLAG_ALIASES = { '-h': '--help' };
const BOOLEAN_FLAGS = new Set(['--inactive', '--json', '--help']);
const KNOWN_VALUE_FLAGS = new Set([
  '--code',
  '--type',
  '--value',
  '--venue',
  '--max-uses-total',
  '--max-uses-per-phone',
  '--valid-from',
  '--valid-until',
]);

const USAGE = `
Promo Code (Coupon) Creation Tool

Usage:
  node scripts/create-promo-code.mjs --code=WELCOME10 --type=percentage --value=10
  npm run promo:create -- --code=FLAT150 --type=flat --value=150 --max-uses-total=500

Required:
  --code=<CODE>               3-50 chars, A-Z 0-9 _ - (normalized to UPPERCASE).
  --type=<flat|percentage>    Discount type.
  --value=<number>            Discount amount. percentage: 0 < v <= 100; flat: v > 0.

Optional:
  --venue=<uuid>              Restrict to one venue (default: platform-wide).
  --max-uses-total=<int>      Global redemption cap (default: unlimited).
  --max-uses-per-phone=<int>  Per-phone redemption cap (default: 1).
  --valid-from=<ISO>          Activation timestamp, ISO 8601 (default: immediately).
  --valid-until=<ISO>         Expiry timestamp, ISO 8601 (default: never).
  --inactive                  Create the coupon deactivated (default: active).
  --json                      Print the created coupon as JSON to stdout.
  --help, -h                  Show this help message.
`;

const parseArgs = (argv) => {
  const args = {};

  for (const raw of argv.slice(2)) {
    const arg = FLAG_ALIASES[raw] || raw;

    if (BOOLEAN_FLAGS.has(arg)) {
      args[arg.slice(2)] = true;
      continue;
    }

    const match = arg.match(/^(--[a-z-]+)=(.*)$/);
    if (match && KNOWN_VALUE_FLAGS.has(match[1])) {
      args[match[1].slice(2)] = match[2];
      continue;
    }

    throw new AppError(`Unknown or malformed argument: ${raw}. Run with --help for usage.`, 400);
  }

  return args;
};

// Assemble the snake_case input the schema validates. Values are left as raw
// strings; Joi (convert: true) performs coercion, so parsing rules live in one
// place. Absent flags are dropped so schema defaults apply.
const buildInput = (args) => {
  const input = {
    code: args.code,
    discount_type: args.type,
    discount_value: args.value,
    venue_id: args.venue,
    max_uses_total: args['max-uses-total'],
    max_uses_per_phone: args['max-uses-per-phone'],
    valid_from: args['valid-from'],
    valid_until: args['valid-until'],
  };

  if (args.inactive) {
    input.is_active = false;
  }

  for (const key of Object.keys(input)) {
    if (input[key] === undefined) {
      delete input[key];
    }
  }

  return input;
};

// Validate with the same options the request-validation middleware uses, so a
// coupon created from the CLI is rejected for exactly the reasons an HTTP
// request would be.
const validateInput = (input) => {
  const { error, value } = couponSchema.validate(input, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      path: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));
    throw new AppError('Validation failed', 400, { errors });
  }

  return value;
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const toCouponData = (value) => ({
  code: value.code,
  discountType: value.discount_type,
  discountValue: value.discount_value,
  venueId: value.venue_id ?? null,
  maxUsesTotal: value.max_uses_total ?? null,
  maxUsesPerPhone: value.max_uses_per_phone,
  validFrom: value.valid_from ?? null,
  validUntil: value.valid_until ?? null,
  isActive: value.is_active,
});

const serializeCoupon = (coupon) => ({
  id: coupon.id,
  venue_id: coupon.venueId ?? null,
  code: coupon.code,
  discount_type: coupon.discountType,
  discount_value: Number(coupon.discountValue),
  max_uses_total: coupon.maxUsesTotal ?? null,
  max_uses_per_phone: coupon.maxUsesPerPhone,
  valid_from: coupon.validFrom ?? null,
  valid_until: coupon.validUntil ?? null,
  is_active: coupon.isActive,
  created_at: coupon.createdAt,
});

const createCoupon = async (prisma, value) => {
  // A venue-scoped coupon must reference a live venue; a null venue is a valid
  // platform-wide coupon.
  if (value.venue_id) {
    const venue = await prisma.venue.findFirst({
      where: { id: value.venue_id, deletedAt: null },
      select: { id: true },
    });
    if (!venue) {
      throw new AppError('Venue not found', 404, { code: 'VENUE_NOT_FOUND' });
    }
  }

  // Pre-check gives a clean message for the common case; the unique index on
  // `code` remains the authoritative guard below.
  const existing = await prisma.coupon.findUnique({ where: { code: value.code } });
  if (existing) {
    throw new AppError('A coupon with this code already exists', 409, { code: 'DUPLICATE_COUPON' });
  }

  try {
    // Single insert — atomic, no partial writes possible.
    return await prisma.coupon.create({ data: toCouponData(value) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('A coupon with this code already exists', 409, {
        code: 'DUPLICATE_COUPON',
        fields: error.meta?.target || [],
      });
    }
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const value = validateInput(buildInput(args));
  const prisma = getPrisma();

  try {
    const coupon = serializeCoupon(await createCoupon(prisma, value));

    if (args.json) {
      process.stdout.write(`${JSON.stringify(coupon, null, 2)}\n`);
    }

    logger.info('[Promo Code] Created successfully', {
      operation: 'promo:create',
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      venueId: coupon.venue_id,
      isActive: coupon.is_active,
    });
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error) => {
  if (error instanceof AppError) {
    logger.error(`[Promo Code] ${error.message}`, {
      operation: 'promo:create:failed',
      statusCode: error.statusCode,
      details: error.details,
    });
  } else {
    logger.error('[Promo Code] Unexpected error', {
      operation: 'promo:create:failed',
      error,
    });
  }
  process.exit(1);
});
