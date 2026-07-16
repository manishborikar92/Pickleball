// Sweep batches mirror the bookings module's sweeper sizing.
export const DEFAULT_SWEEP_LIMIT = 100;

// Machine codes surfaced in error `details.code` (spec §11 error table).
export const REWARD_ERROR_CODES = {
  NOT_FOUND: 'REWARD_NOT_FOUND',
  ALREADY_REVEALED: 'REWARD_ALREADY_REVEALED',
  EXPIRED: 'REWARD_EXPIRED',
  VOUCHER_NOT_REDEEMABLE: 'VOUCHER_NOT_REDEEMABLE',
  VOUCHER_ALREADY_REDEEMED: 'VOUCHER_ALREADY_REDEEMED',
  VOUCHER_EXPIRED: 'VOUCHER_EXPIRED',
};

// Voucher codes are read out / shown at the stall — short, unambiguous
// alphabet with no 0/O or 1/I lookalikes.
export const VOUCHER_CODE_PREFIX = 'RWD-';
export const VOUCHER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const VOUCHER_CODE_RANDOM_LENGTH = 8;

// Default redemption window after reveal when a prize doesn't set its own.
export const DEFAULT_VOUCHER_VALIDITY_DAYS = 30;

// Probabilities are user-entered decimals; allow float representation error.
export const PROBABILITY_SUM_TOLERANCE = 1e-9;
