import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

// Ensure global window.L is assigned before leaflet.heat loads
if (typeof window !== "undefined") {
  (window as any).L = L;
}
import "leaflet.heat";

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity?: number;
}

export interface HeatmapLayerProps {
  points: HeatmapPoint[];
  radius?: number;
  blur?: number;
  maxZoom?: number;
  max?: number;
  minOpacity?: number;
  gradient?: { [key: number]: string };
}

export function HeatmapLayer({
  points,
  radius = 28,
  blur = 18,
  maxZoom = 15,
  max = 1.0,
  minOpacity = 0.38,
  gradient = {
    0.2: "#06b6d4", // Cyan
    0.4: "#10b981", // Emerald
    0.6: "#eab308", // Yellow
    0.8: "#f97316", // Orange
    1.0: "#ef4444"  // Red
  }
}: HeatmapLayerProps) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Convert points to [lat, lng, intensity] format
    const heatData: [number, number, number][] = points.map((p) => [
      p.lat,
      p.lng,
      p.intensity ?? 0.8
    ]);

    // Check if L.heatLayer exists (attached by leaflet.heat)
    const heatLayerFn = (L as any).heatLayer;
    if (typeof heatLayerFn === "function") {
      const layer = heatLayerFn(heatData, {
        radius,
        blur,
        maxZoom,
        max,
        minOpacity,
        gradient
      });

      layer.addTo(map);
      heatLayerRef.current = layer;

      return () => {
        if (layer && map) {
          map.removeLayer(layer);
        }
      };
    } else {
      console.warn("L.heatLayer is not available on Leaflet instance");
    }
  }, [map, points, radius, blur, maxZoom, max, minOpacity, gradient]);

  return null;
}
