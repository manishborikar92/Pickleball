/**
 * Map Configuration
 * Provider-agnostic map settings and constants.
 */

export const MAP_CONFIG = {
  // MapTiler default style (Dark)
  // Replace {key} with your MapTiler API key
  STYLE_URL: (key) => `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=${key}`,
  
  DEFAULT_ZOOM: 15,
  MIN_ZOOM: 3,
  MAX_ZOOM: 20,
  
  // Default coordinates (Nagpur, India area for now)
  DEFAULT_CENTER: {
    lat: 21.0851090,
    lng: 79.0859310
  },

  MARKER_SIZE: 40,
  
  // Interaction settings
  INTERACTION: {
    scrollZoom: false, // Prevents scroll traps on mobile
    dragPan: true,
    doubleClickZoom: true,
    touchZoomRotate: true,
  }
};
