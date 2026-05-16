/**
 * Navigation Utilities
 * Generates deep-links for native map applications.
 */

export const getMapDirectionsUrl = (lat, lng, label = '') => {
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const encodedLabel = encodeURIComponent(label);

  if (isIOS) {
    // Apple Maps deep link
    return `maps://?q=${encodedLabel}&ll=${lat},${lng}&z=15`;
  }

  // Google Maps deep link (Android and Web)
  // Using query for label support and destination for exact coordinates
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
};

export const getGoogleMapsBrowserUrl = (lat, lng, label = '') => {
  const encodedLabel = encodeURIComponent(label);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}${label ? `&query_place_id=${encodedLabel}` : ''}`;
};
