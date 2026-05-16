"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_CONFIG } from '@/config/map.config';
import { VenueMarker } from './VenueMarker';
import { MapControls } from './MapControls';
import { Button } from '@/components/shared';
import { getMapDirectionsUrl } from '@/lib/navigation';

/**
 * MapCore Component
 * The interactive WebGL map engine. Loaded dynamically.
 */
export default function MapCore({ 
  lat = MAP_CONFIG.DEFAULT_CENTER.lat, 
  lng = MAP_CONFIG.DEFAULT_CENTER.lng,
  name = "Venue",
  address = "",
  apiKey = "",
  onError
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [viewState, setViewState] = useState({
    latitude: lat,
    longitude: lng,
    zoom: MAP_CONFIG.DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0
  });
  const isMobile = window.innerWidth < 640;

  // Handle viewport changes
  const onMove = useCallback(({ viewState }) => {
    setViewState(viewState);
  }, []);

  // Mobile-optimized popup toggle with viewport biasing
  const handleMarkerClick = useCallback((e) => {
    if (e && e.originalEvent) e.originalEvent.stopPropagation();
    
    setShowPopup(true);
  
    const verticalOffset = 80; 

    mapRef.current?.easeTo({
      center: [lng, lat],
      offset: [0, verticalOffset],
      duration: 800,
      essential: true
    });
  }, [lat, lng]);

  const handleCenter = useCallback(() => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: MAP_CONFIG.DEFAULT_ZOOM,
      duration: 1500,
      essential: true
    });
    setShowPopup(false); // Reset popup on manual recenter
  }, [lat, lng]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  // Sync map size with container size (Critical for desktop/grid stability)
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.getMap().resize();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Cleanup map instance
  useEffect(() => {
    const currentMap = mapRef.current;
    return () => {
      if (currentMap) {
        // MapLibre cleanup
      }
    };
  }, []);

  const directionsUrl = getMapDirectionsUrl(lat, lng, name);

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden rounded-xl border border-line/10 bg-surface shadow-2xl"
    >
      <Map
        {...viewState}
        ref={mapRef}
        onMove={onMove}
        onStyleData={() => setIsStyleLoaded(true)}
        onError={(e) => onError?.(e.error)}
        mapStyle={MAP_CONFIG.STYLE_URL(apiKey)}
        minZoom={MAP_CONFIG.MIN_ZOOM}
        maxZoom={MAP_CONFIG.MAX_ZOOM}
        scrollZoom={MAP_CONFIG.INTERACTION.scrollZoom}
        dragPan={MAP_CONFIG.INTERACTION.dragPan}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Only render markers after style is ready to prevent artifacts */}
        {isStyleLoaded && (
          <>
            <Marker 
              latitude={lat} 
              longitude={lng} 
              anchor="bottom"
              onClick={handleMarkerClick}
            >
              <VenueMarker onClick={handleMarkerClick} />
            </Marker>

            {showPopup && (
              <Popup
                latitude={lat}
                longitude={lng}
                anchor="bottom"
                offset={isMobile ? 45 : 50}
                onClose={() => setShowPopup(false)}
                closeButton={false}
                maxWidth="260px"
                focusAfterOpen={false}
                className="z-20 custom-map-popup"
              >
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <h5 className="font-bold text-sm sm:text-base text-foreground leading-tight">{name}</h5>
                    <button 
                      onClick={() => setShowPopup(false)}
                      className="p-1 -mr-1.5 -mt-1.5 text-muted hover:text-foreground transition-colors"
                      aria-label="Close popup"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted leading-relaxed line-clamp-2">{address}</p>
                  
                  <Button 
                    as="a" 
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm" 
                    className="mt-0 w-full text-[12px] h-7 min-h-0 py-0 px-2"
                  >
                    Get Directions
                  </Button>
                </div>
              </Popup>
            )}
          </>
        )}

        <MapControls 
          onCenter={handleCenter}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
      </Map>

      {/* Global Style for Popup overrides */}
      <style jsx global>{`
        .custom-map-popup .maplibregl-popup-content {
          background: #1A1A1A;
          color: white;
          border-radius: 12px;
          padding: 14px; 
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.6);
        }
        @media (min-width: 640px) {
          .custom-map-popup .maplibregl-popup-content {
            padding: 18px;
          }
        }
        .custom-map-popup .maplibregl-popup-tip {
          display: none;
        }
        .custom-map-popup .maplibregl-popup-close-button {
          display: none; 
        }
      `}</style>
    </div>
  );
}
