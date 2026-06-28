/**
 * Map Utilities
 * Shared helper functions for map operations.
 */

export const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

/**
 * Format coordinates for display or API calls
 */
export const formatCoords = (lat, lng) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
