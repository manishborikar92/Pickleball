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
  const [showPopup, setShowPopup] = useState(false);
  const [viewState, setViewState] = useState({
    latitude: lat,
    longitude: lng,
    zoom: MAP_CONFIG.DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0
  });

  // Handle viewport changes without parent re-renders
  const onMove = useCallback(({ viewState }) => {
    setViewState(viewState);
  }, []);

  const handleCenter = useCallback(() => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: MAP_CONFIG.DEFAULT_ZOOM,
      duration: 1500
    });
  }, [lat, lng]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  // Cleanup map instance on unmount
  useEffect(() => {
    const currentMap = mapRef.current;
    return () => {
      if (currentMap) {
        // MapLibre handle cleanup internally with react-map-gl
      }
    };
  }, []);

  const directionsUrl = getMapDirectionsUrl(lat, lng, name);

  return (
    <div className="relative h-full w-full min-h-[inherit] overflow-hidden rounded-xl border border-line/10">
      <Map
        {...viewState}
        ref={mapRef}
        onMove={onMove}
        onError={(e) => onError?.(e.error)}
        mapStyle={MAP_CONFIG.STYLE_URL(apiKey)}
        minZoom={MAP_CONFIG.MIN_ZOOM}
        maxZoom={MAP_CONFIG.MAX_ZOOM}
        scrollZoom={MAP_CONFIG.INTERACTION.scrollZoom}
        dragPan={MAP_CONFIG.INTERACTION.dragPan}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Venue Marker */}
        <Marker 
          latitude={lat} 
          longitude={lng} 
          anchor="bottom"
          onClick={e => {
            e.originalEvent.stopPropagation();
            setShowPopup(true);
          }}
        >
          <VenueMarker onClick={() => setShowPopup(true)} />
        </Marker>

        {/* Info Popup */}
        {showPopup && (
          <Popup
            latitude={lat}
            longitude={lng}
            anchor="bottom"
            offset={40}
            onClose={() => setShowPopup(false)}
            closeButton={false}
            maxWidth="280px"
            className="z-20 custom-map-popup"
          >
            <div className="p-1">
              <h5 className="font-bold text-base text-foreground mb-1">{name}</h5>
              <p className="text-xs text-muted leading-relaxed mb-4">{address}</p>
              
              <Button 
                as="a" 
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm" 
                className="w-full text-[11px] h-9 py-0"
              >
                Get Directions
              </Button>
            </div>
          </Popup>
        )}

        {/* Custom Controls */}
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
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .custom-map-popup .maplibregl-popup-tip {
          border-top-color: #1A1A1A;
        }
      `}</style>
    </div>
  );
}
