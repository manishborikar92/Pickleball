"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useInView } from 'react-intersection-observer';
import { MapPlaceholder } from './MapPlaceholder';
import { MapFallback } from './MapFallback';

// Dynamically import MapCore with no SSR
const MapCore = dynamic(() => import('./MapCore'), {
  ssr: false,
  loading: () => <MapPlaceholder />
});

/**
 * MapWrapper Component
 * Handles deferred hydration via IntersectionObserver.
 * Ensures the heavy WebGL engine is only loaded when needed.
 */
export function MapWrapper({ className = "", ...props }) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  const { ref } = useInView({
    triggerOnce: true,
    threshold: 0.1, // Trigger when 10% visible
    onChange: (inView) => {
      if (inView && !hasHydrated) {
        setHasHydrated(true);
      }
    }
  });

  const handleRetry = () => {
    setLoadError(null);
    setHasHydrated(false);
    // Use a timeout to trigger hydration again
    setTimeout(() => setHasHydrated(true), 100);
  };

  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";
  
  // Sizing classes that match the placeholder to prevent CLS
  const sizingClasses = "min-h-64 sm:min-h-80 h-full w-full";

  // Defensive validation for missing API key
  if (hasHydrated && !apiKey) {
    return (
      <div className={`${sizingClasses} ${className}`}>
        <MapFallback 
          error="Missing API Key" 
          onRetry={handleRetry} 
        />
      </div>
    );
  }

  // Show placeholder until in view or during loading
  if (!hasHydrated && !loadError) {
    return (
      <div ref={ref} className={`${sizingClasses} ${className}`}>
        <MapPlaceholder />
      </div>
    );
  }

  // Show fallback if loading fails
  if (loadError) {
    return (
      <div className={`${sizingClasses} ${className}`}>
        <MapFallback error={loadError} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div ref={ref} className={`${sizingClasses} ${className}`}>
      <MapCore 
        {...props} 
        apiKey={apiKey} 
        onError={(err) => {
          console.error("MapCore Load Error:", err);
          setLoadError(err);
        }}
      />
    </div>
  );
}
