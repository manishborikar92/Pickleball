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
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedLabel}`;
};

export const getGoogleMapsBrowserUrl = (lat, lng) => {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};
