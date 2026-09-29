import { useMemo, useEffect, useState, useRef, MutableRefObject } from "react";
import { 
  MapContainer, 
  TileLayer,
  Polygon, 
  Polyline,
  Marker, 
  Popup,
  Tooltip,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Hotspot } from "../types";
import { 
  getIupkCoordinates, 
  getBufferCoordinates, 
  getHaulRoadBufferCoordinates,
  ADARO_HAUL_ROAD_MILESTONES,
  iupkMetadata
} from "../data";
import { 
  ADARO_HAUL_ROAD_COORDINATES,
  KELANIS_PORT_COORDINATES
} from "../adaroSecurityData";
import { formatDateWITA, formatTimeWITA, fetchAddressFromCoordinates } from "../utils";
import { 
  Flame, 
  Layers, 
  X, 
  Navigation, 
  Anchor, 
  MapPin,
  Compass,
  Maximize2,
  Wind,
  Satellite,
  Sun
} from "lucide-react";
import { renderToString } from "react-dom/server";
import { CompassRose } from "./CompassRose";
import { WeatherWidget } from "./WeatherWidget";
import { WeatherModal } from "./WeatherModal";
import { HeatmapLayer, HeatmapPoint } from "./HeatmapLayer";
import {
  fetchStationWeather,
  fetchRainViewerRadar,
  RainViewerMetadata,
  StationWeatherData,
  WeatherStation,
  OPERATIONAL_WEATHER_STATIONS,
  CORRIDOR_WIND_POINTS
} from "../weatherData";
import { calculateSmokePlume, SmokePlumeAnalysis } from "../smokePlume";

interface MapComponentProps {
  hotspots: Hotspot[];
  boundaryLoaded: boolean;
  selectedHotspot?: Hotspot | null;
  onSelectHotspot?: (hotspot: Hotspot) => void;
  onWeatherLoaded?: (stations: Record<string, StationWeatherData>) => void;
  onOpenFdrsModal?: () => void;
}

// Controller component inside MapContainer to smoothly navigate
function MapController({ 
  selectedHotspot, 
  iupkPolygons,
  focusMode,
  onZoomChange,
  targetFly,
  markerRefs
}: { 
  selectedHotspot?: Hotspot | null,
  iupkPolygons: [number, number][][],
  focusMode: "full" | "mine" | "kelanis" | "none",
  onZoomChange?: (zoom: number) => void,
  targetFly?: { lat: number; lng: number; zoom: number; timestamp: number; hotspotId?: string } | null,
  markerRefs: MutableRefObject<Record<string, L.Marker>>
}) {
  const map = useMap();

  useEffect(() => {
    if (!onZoomChange) return;
    onZoomChange(map.getZoom());
    const handleZoom = () => onZoomChange(map.getZoom());
    map.on("zoomend", handleZoom);
    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map, onZoomChange]);

  // Priority 1: Direct trigger from clicking "Lihat" in notification banner
  useEffect(() => {
    if (targetFly) {
      map.flyTo([targetFly.lat, targetFly.lng], targetFly.zoom, {
        duration: 1.2,
      });
      if (targetFly.hotspotId) {
        const timer = setTimeout(() => {
          const marker = markerRefs.current[targetFly.hotspotId!];
          if (marker) {
            marker.openPopup();
          }
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [targetFly, map, markerRefs]);

  // Priority 2: When selectedHotspot or focusMode changes
  useEffect(() => {
    // If a hotspot is selected, zoom directly to it at close range (level 16)
    if (selectedHotspot) {
      map.flyTo([selectedHotspot.location.lat, selectedHotspot.location.lng], 16, {
        duration: 1.2,
      });
      const timer = setTimeout(() => {
        const marker = markerRefs.current[selectedHotspot.id];
        if (marker) {
          marker.openPopup();
        }
      }, 700);
      return () => clearTimeout(timer);
    } 
    else if (focusMode === "full") {
      // Bounds covering Kelanis Port (114.85) to East Mine Concession (115.62)
      const fullBounds = L.latLngBounds([[-2.34, 114.84], [-2.06, 115.62]]);
      map.fitBounds(fullBounds, { padding: [30, 30], duration: 1 });
    }
    else if (focusMode === "mine") {
      if (iupkPolygons && iupkPolygons.length > 0 && iupkPolygons[0].length > 0) {
        const allPoints = iupkPolygons.flat();
        if (allPoints.length > 0) {
          const bounds = L.latLngBounds(allPoints);
          map.fitBounds(bounds, { padding: [40, 40], duration: 1 });
        }
      }
    }
    else if (focusMode === "kelanis") {
      map.flyTo([-2.2935, 114.8715], 15, { duration: 1 });
    }
  }, [selectedHotspot, iupkPolygons, focusMode, map, markerRefs]);

  return null;
}

// Custom icon creator for Hotspots with recency indicator
const createHotspotIcon = (status: "new" | "acknowledged" | "resolved", daysAgo: number = 0) => {
  const isNew = status === "new" || daysAgo === 0;
  const isOlder = daysAgo > 7;
  
  let bgClasses = 'bg-amber-500 border-amber-700 shadow-amber-500/50';
  if (isNew) {
    bgClasses = 'bg-red-500 border-red-700 shadow-red-500/50';
  } else if (isOlder) {
    bgClasses = 'bg-orange-600 border-orange-800 shadow-orange-950/50';
  }

  const iconHtml = renderToString(
    <div className={`relative flex items-center justify-center ${isNew ? 'scale-125' : 'scale-100'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg ${bgClasses}`}>
        <Flame className="w-4 h-4 text-white" />
      </div>
      {isNew && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-red-500/40 rounded-full animate-ping pointer-events-none -z-10" />
      )}
      {daysAgo > 0 && (
        <div className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-slate-900/90 border border-slate-700 rounded text-[9px] font-bold font-mono text-amber-300 shadow leading-none">
          {daysAgo}h
        </div>
      )}
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: "custom-leaflet-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

// Custom icon creator for Haul Road Milestones (KM markers)
const createMilestoneIcon = (km: number | string, isMajor: boolean, isCompact: boolean) => {
  if (isCompact) {
    const iconHtml = renderToString(
      <div className="flex items-center justify-center cursor-pointer group">
        <div className={`w-3 h-3 rounded-full border flex items-center justify-center shadow-sm transition-transform group-hover:scale-150 ${
          isMajor 
            ? "bg-amber-400 border-amber-600 ring-2 ring-amber-400/40" 
            : "bg-slate-900 border-amber-400/80"
        }`}>
          <div className={`w-1 h-1 rounded-full ${isMajor ? "bg-slate-950" : "bg-amber-400"}`} />
        </div>
      </div>
    );

    return L.divIcon({
      html: iconHtml,
      className: "custom-km-dot-icon",
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      popupAnchor: [0, -8]
    });
  }

  const isMajorOrEdge = isMajor;
  const iconHtml = renderToString(
    <div className={`px-1.5 py-0.5 rounded shadow-md flex items-center gap-1 font-mono text-[10px] font-bold border whitespace-nowrap cursor-pointer transition-all hover:scale-110 select-none ${
      isMajorOrEdge
        ? "bg-amber-500 text-slate-950 border-amber-300 font-extrabold shadow-amber-500/40"
        : "bg-slate-900/95 text-amber-300 border-amber-500/70 shadow-slate-950/60"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMajorOrEdge ? "bg-slate-950" : "bg-amber-400"}`} />
      <span>KM {km}</span>
    </div>
  );

  const width = isMajorOrEdge ? 52 : 46;
  return L.divIcon({
    html: iconHtml,
    className: "custom-km-icon",
    iconSize: [width, 20],
    iconAnchor: [width / 2, 10],
    popupAnchor: [0, -10]
  });
};

const PopupAddress = ({ lat, lng, initialAddress }: { lat: number, lng: number, initialAddress?: string }) => {
  const [address, setAddress] = useState<string>(() => initialAddress || "Memuat lokasi...");
  
  useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress);
      return;
    }
    let isMounted = true;
    fetchAddressFromCoordinates(lat, lng).then(res => {
      if (isMounted) setAddress(res);
    });
    return () => { isMounted = false; };
  }, [lat, lng, initialAddress]);

  return (
    <div className="text-[11px] mt-1.5 text-slate-700 leading-tight border-t border-slate-100 pt-1.5">
      <span className="font-semibold text-slate-800">Lokasi:</span> {address}
    </div>
  );
};

export default function MapComponent({ 
  hotspots, 
  boundaryLoaded, 
  selectedHotspot,
  onSelectHotspot,
  onWeatherLoaded,
  onOpenFdrsModal
}: MapComponentProps) {
  const [showIupk, setShowIupk] = useState(true);
  const [showHaulRoad, setShowHaulRoad] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [heatmapRadius, setHeatmapRadius] = useState<number>(28);
  const [heatmapBlur, setHeatmapBlur] = useState<number>(18);
  const [showAdmin, setShowAdmin] = useState(true);
  const [showSmokePlume, setShowSmokePlume] = useState<boolean>(true);
  const [smokePlumeHours, setSmokePlumeHours] = useState<1 | 2 | 3>(2);
  const [mapType, setMapType] = useState<"street" | "satellite" | "esri">("satellite");
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [focusMode, setFocusMode] = useState<"full" | "mine" | "kelanis" | "none">("full");
  const [currentZoom, setCurrentZoom] = useState<number>(10);

  // Weather & Satellite state
  const [weatherStationsData, setWeatherStationsData] = useState<Record<string, StationWeatherData>>({});
  const [selectedWeatherStationId, setSelectedWeatherStationId] = useState<string>("kelanis-port");
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState<boolean>(false);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [showWeatherRadar, setShowWeatherRadar] = useState<boolean>(false);
  const [weatherOverlayMode, setWeatherOverlayMode] = useState<"radar" | "satellite" | "both">("radar");
  const [radarOpacity, setRadarOpacity] = useState<number>(0.72);
  const [showWindFlow, setShowWindFlow] = useState<boolean>(false);
  const [radarMetadata, setRadarMetadata] = useState<RainViewerMetadata | null>(null);

  // Center between Kelanis and Tanjung Tambang
  const initialCenter: [number, number] = [-2.20, 115.20];
  
  const iupkMultiPolygons = useMemo(() => 
    getIupkCoordinates().map(ring => ring.map(c => [c.lat, c.lng] as [number, number])), 
  [boundaryLoaded]);
  
  const bufferMultiPolygons = useMemo(() => 
    getBufferCoordinates().map(ring => ring.map(c => [c.lat, c.lng] as [number, number])), 
  [boundaryLoaded]);

  const haulRoadBufferMultiPolygons = useMemo(() => 
    getHaulRoadBufferCoordinates().map(ring => ring.map(c => [c.lat, c.lng] as [number, number])), 
  []);

  // Pre-calculate smoke plume dispersion analysis for all hotspots
  const smokePlumes = useMemo<SmokePlumeAnalysis[]>(() => {
    if (!showSmokePlume || !showHotspots) return [];
    return hotspots.map((h) => calculateSmokePlume(h));
  }, [hotspots, showSmokePlume, showHotspots]);

  // Hotspot density points for Heatmap Layer
  const heatmapPoints = useMemo<HeatmapPoint[]>(() => {
    return hotspots.map((h) => {
      // Weight intensity based on confidence and recency
      const baseConf = (h.confidence || 75) / 100;
      const recencyWeight = h.daysAgo === 0 ? 1.0 : h.daysAgo <= 2 ? 0.85 : 0.7;
      return {
        lat: h.location.lat,
        lng: h.location.lng,
        intensity: Math.min(1.0, Math.max(0.4, baseConf * recencyWeight))
      };
    });
  }, [hotspots]);

  const markerRefs = useRef<Record<string, L.Marker>>({});
  const [targetFly, setTargetFly] = useState<{ lat: number; lng: number; zoom: number; timestamp: number; hotspotId?: string } | null>(null);

  const newHotspots = hotspots.filter(h => h.status === 'new');
  const latestNewHotspot = newHotspots.length > 0 ? newHotspots[0] : null;

  // Direct zoom into hotspot location (e.g. from notification banner)
  const handleViewHotspot = (hotspot: Hotspot) => {
    setShowHotspots(true);
    setFocusMode("none");
    setTargetFly({
      lat: hotspot.location.lat,
      lng: hotspot.location.lng,
      zoom: 16,
      timestamp: Date.now(),
      hotspotId: hotspot.id,
    });
    onSelectHotspot?.(hotspot);
  };

  // Reset alert dismiss when new hotspot appears
  useEffect(() => {
    if (newHotspots.length > 0) {
      setAlertDismissed(false);
    }
  }, [newHotspots.length]);

  // Load weather data for 3 key operational stations
  const loadAllWeather = async () => {
    setWeatherLoading(true);
    try {
      const results: Record<string, StationWeatherData> = {};
      await Promise.all(
        OPERATIONAL_WEATHER_STATIONS.map(async (stn) => {
          const data = await fetchStationWeather(stn);
          results[stn.id] = data;
        })
      );
      setWeatherStationsData(results);
      onWeatherLoaded?.(results);
    } catch (e) {
      console.error("Error loading weather data:", e);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    loadAllWeather();
    // Pre-fetch RainViewer radar metadata in background
    fetchRainViewerRadar().then((meta) => {
      if (meta) setRadarMetadata(meta);
    });
    // Auto refresh every 10 minutes
    const timer = setInterval(loadAllWeather, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to determine wind data along the corridor
  const getWindForPoint = (lng: number) => {
    if (lng < 115.05) {
      return weatherStationsData["kelanis-port"]?.current || null;
    } else if (lng < 115.35) {
      return weatherStationsData["hauling-km35"]?.current || null;
    } else {
      return weatherStationsData["mine-pit-tutupan"]?.current || null;
    }
  };

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={initialCenter} 
        zoom={10} 
        minZoom={7}
        maxZoom={20}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapController 
          selectedHotspot={selectedHotspot} 
          iupkPolygons={iupkMultiPolygons}
          focusMode={focusMode}
          onZoomChange={setCurrentZoom}
          targetFly={targetFly}
          markerRefs={markerRefs}
        />

        {mapType === "street" ? (
          <TileLayer
            key="basemap-street"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19}
            maxZoom={20}
          />
        ) : mapType === "esri" ? (
          <TileLayer
            key="basemap-esri"
            attribution='&copy; Esri World Imagery'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={17}
            maxZoom={20}
          />
        ) : (
          <TileLayer
            key="basemap-satellite-google"
            attribution='&copy; Google Maps Satelit Hybrid'
            url="https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            subdomains={["0", "1", "2", "3"]}
            maxNativeZoom={20}
            maxZoom={20}
          />
        )}

        {/* Overlay Label & Batas Administrasi Wilayah (Desa, Kecamatan, Kabupaten) */}
        {showAdmin && mapType !== "satellite" && (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
            opacity={0.9}
            maxNativeZoom={19}
            maxZoom={21}
          />
        )}

        {/* 1. Main IUPK Concession Boundary (ESDM GeoJSON) */}
        {showIupk && (
          <Polygon 
            positions={iupkMultiPolygons} 
            pathOptions={{
              fillColor: "#000000",
              fillOpacity: 0.05,
              color: "#000000",
              weight: 2.5,
              dashArray: "6, 4",
            }} 
          >
            <Tooltip sticky>
              <div className="p-1 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-slate-900 inline-block"></span>
                  <span>Batas Konsesi IUPK</span>
                </div>
                <div className="text-[11px] text-slate-700 font-mono">
                  SK: {iupkMetadata?.sk_iup || "11/1/IUP/PMA/2022"}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  Kegiatan: {iupkMetadata?.kegiatan || "Operasi Produksi"} ({iupkMetadata?.jenis_izin || "IUPK"})
                </div>
                <div className="text-[10px] text-slate-500">
                  Luas SK: {iupkMetadata?.luas_sk ? `${iupkMetadata.luas_sk.toLocaleString("id-ID")} Ha` : "23.942 Ha"} • {iupkMetadata?.nama_kab || "Tabalong & Balangan"}
                </div>
                <div className="text-[9px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Sumber Resmi: Geoportal Kementerian ESDM RI</span>
                </div>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {/* 2. 1 km Buffer Zone around Mining Concession and Haul Road Corridor */}
        {showBuffer && (
          <>
            <Polygon 
              positions={bufferMultiPolygons} 
              pathOptions={{
                fillColor: "#eab308",
                fillOpacity: 0.06,
                color: "#ca8a04",
                weight: 1.5,
                dashArray: "3, 3",
                interactive: false
              }} 
            />
            {haulRoadBufferMultiPolygons.length > 0 && (
              <Polygon 
                positions={haulRoadBufferMultiPolygons} 
                pathOptions={{
                  fillColor: "#eab308",
                  fillOpacity: 0.04,
                  color: "#d97706",
                  weight: 2,
                  dashArray: "6, 6",
                  interactive: false
                }} 
              />
            )}
          </>
        )}

        {/* Label Sungai Barito (seperti pada referensi visual di area Kelanis Port) */}
        <Marker
          position={[-2.2942, 114.8638]}
          interactive={false}
          zIndexOffset={50}
          icon={L.divIcon({
            html: `<div style="transform: rotate(-74deg); font-family: system-ui, -apple-system, sans-serif; font-weight: 800; font-size: 15px; letter-spacing: 0.5px; color: #ffffff; text-shadow: -1.5px -1.5px 0 #0284c7, 1.5px -1.5px 0 #0284c7, -1.5px 1.5px 0 #0284c7, 1.5px 1.5px 0 #0284c7, 0 2px 4px rgba(0,0,0,0.7); white-space: nowrap; user-select: none; pointer-events: none;">Sungai Barito</div>`,
            className: "barito-river-label",
            iconSize: [140, 32],
            iconAnchor: [70, 16],
          })}
        />

        {/* 3. Area Khusus Pelabuhan Kelanis Port (KM 0) */}
        {showIupk && (
          <Polygon 
            positions={KELANIS_PORT_COORDINATES} 
            pathOptions={{
              fillColor: "#0284c7",
              fillOpacity: 0.03,
              color: "#0284c7",
              weight: 1.5,
              dashArray: "4, 4",
            }} 
          >
            <Tooltip sticky>
              <div className="p-0.5">
                <span className="font-bold text-xs text-slate-900 block">Pelabuhan Khusus Batubara Kelanis (Port)</span>
                <span className="text-[11px] text-slate-600 block">Terminal Pengapalan Sungai Barito & Titik KM 0 Hauling</span>
              </div>
            </Tooltip>
          </Polygon>
        )}

        {/* 4. Dedicated Haul Road (Kelanis KM 0 to KM 71) */}
        {showHaulRoad && (
          <>
            {/* Outer casing */}
            <Polyline
              positions={ADARO_HAUL_ROAD_COORDINATES}
              pathOptions={{
                color: "#475569",
                weight: 6,
                opacity: 0.85
              }}
            />
            {/* Inner line */}
            <Polyline
              positions={ADARO_HAUL_ROAD_COORDINATES}
              pathOptions={{
                color: "#94a3b8",
                weight: 3.5,
                opacity: 1
              }}
            >
              <Tooltip sticky>
                <span className="font-bold text-xs">Jalur Hauling Road (KM 0 - KM 71)</span>
              </Tooltip>
            </Polyline>
          </>
        )}

        {/* 5. Haul Road Milestones (KM Markers per 1 km) */}
        {showHaulRoad && showMilestones && ADARO_HAUL_ROAD_MILESTONES.map((m) => {
          const isCompact = currentZoom < 12 && !m.isMajor;
          return (
            <Marker
              key={`milestone-${m.label}`}
              position={[m.lat, m.lng]}
              icon={createMilestoneIcon(m.km, !!m.isMajor, isCompact)}
              zIndexOffset={m.isMajor ? 400 : 200}
            >
              <Tooltip direction="top" offset={[0, isCompact ? -6 : -10]} opacity={0.95}>
                <span className="font-mono font-bold text-xs">{m.label}</span>
              </Tooltip>
              <Popup className="custom-popup">
                <div className="text-xs font-sans p-1 min-w-[210px]">
                  <div className="font-bold text-slate-900 flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200">
                    <span className="text-amber-700 flex items-center gap-1.5 font-mono text-sm">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      {m.label}
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                      Haul Road
                    </span>
                  </div>
                  <div className="text-slate-700 font-medium mb-1">
                    {m.description || `Jalur Hauling Road`}
                  </div>
                  <div className="text-slate-500 text-[11px] mb-2">
                    Jarak dari Kelanis: <span className="font-semibold text-slate-800">{m.km} km</span>
                  </div>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block text-[11px] font-mono text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors"
                    title="Buka titik koordinat KM ini di Google Maps"
                  >
                    Lat: {m.lat.toFixed(5)}<br/>
                    Lng: {m.lng.toFixed(5)}
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
        

        {/* 6b. Smoke Plume & Dispersion Projection (1 - 3 Jam) */}
        {showSmokePlume && showHotspots && smokePlumes.map((plume) => {
          const isCritical = plume.impacts.severity === "critical";
          const isWarning = plume.impacts.severity === "warning";

          return (
            <div key={`smoke-group-${plume.hotspotId}`}>
              {/* 3-Hour Outer Dispersion Plume (Light Haze) */}
              {smokePlumeHours >= 3 && (
                <Polygon
                  positions={plume.coneRings.threeHour}
                  pathOptions={{
                    color: "#f97316",
                    fillColor: "#ea580c",
                    fillOpacity: 0.12,
                    weight: 1,
                    dashArray: "4 4",
                  }}
                  interactive={true}
                >
                  <Tooltip direction="top" offset={[0, -10]}>
                    <div className="p-1 text-xs">
                      <div className="font-bold text-orange-600 flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5" />
                        <span>Proyeksi Asap (3 Jam): {plume.downwindCardinal}</span>
                      </div>
                      <div className="text-[11px] text-slate-700 mt-0.5">{plume.impacts.summaryText}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Kecepatan: {plume.windSpeed} km/j • Radius: ~{(plume.windSpeed * 3).toFixed(1)} km
                      </div>
                    </div>
                  </Tooltip>
                </Polygon>
              )}

              {/* 2-Hour Mid Dispersion Plume (Moderate Smoke) */}
              {smokePlumeHours >= 2 && (
                <Polygon
                  positions={plume.coneRings.twoHour}
                  pathOptions={{
                    color: isCritical ? "#ef4444" : "#ea580c",
                    fillColor: isCritical ? "#dc2626" : "#ea580c",
                    fillOpacity: 0.22,
                    weight: 1.2,
                  }}
                  interactive={true}
                >
                  <Tooltip direction="top" offset={[0, -10]}>
                    <div className="p-1 text-xs">
                      <div className="font-bold text-orange-600 flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5" />
                        <span>Proyeksi Asap (2 Jam): {plume.downwindCardinal}</span>
                      </div>
                      <div className="text-[11px] text-slate-700 mt-0.5">{plume.impacts.summaryText}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Kecepatan: {plume.windSpeed} km/j • Radius: ~{(plume.windSpeed * 2).toFixed(1)} km
                      </div>
                    </div>
                  </Tooltip>
                </Polygon>
              )}

              {/* 1-Hour Core Dispersion Plume (Dense Smoke) */}
              <Polygon
                positions={plume.coneRings.oneHour}
                pathOptions={{
                  color: isCritical ? "#b91c1c" : "#c2410c",
                  fillColor: isCritical ? "#ef4444" : "#f97316",
                  fillOpacity: 0.38,
                  weight: 1.5,
                }}
                interactive={true}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="p-1 text-xs">
                    <div className="font-bold text-red-600 flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5" />
                      <span>Zona Asap Pekat (1 Jam): {plume.downwindCardinal}</span>
                    </div>
                    <div className="text-[11px] text-slate-700 mt-0.5">{plume.impacts.summaryText}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Kecepatan: {plume.windSpeed} km/j • Radius: ~{Math.max(1.2, plume.windSpeed).toFixed(1)} km
                    </div>
                    <div className="text-[10px] text-red-600 font-bold mt-1 pt-1 border-t border-slate-200">
                      {plume.impacts.driverVisibilityAdvisory}
                    </div>
                  </div>
                </Tooltip>
              </Polygon>

              {/* Centerline Drift Vector */}
              <Polyline
                positions={plume.centerline}
                pathOptions={{
                  color: isCritical ? "#dc2626" : "#ea580c",
                  weight: 2,
                  dashArray: "6 6",
                  opacity: 0.85,
                }}
              />
            </div>
          );
        })}

        {/* 6c. Hotspot Density Heatmap Layer */}
        {showHeatmap && heatmapPoints.length > 0 && (
          <HeatmapLayer
            points={heatmapPoints}
            radius={heatmapRadius}
            blur={heatmapBlur}
            maxZoom={15}
            minOpacity={0.38}
          />
        )}

        {/* 7. Thermal Hotspots */}
        {showHotspots && hotspots.map(hotspot => {
          const plume = smokePlumes.find(p => p.hotspotId === hotspot.id);

          return (
          <Marker
            key={hotspot.id}
            ref={(ref) => {
              if (ref) {
                markerRefs.current[hotspot.id] = ref;
              } else {
                delete markerRefs.current[hotspot.id];
              }
            }}
            position={[hotspot.location.lat, hotspot.location.lng]}
            icon={createHotspotIcon(hotspot.status, hotspot.daysAgo)}
            eventHandlers={{
              click: () => onSelectHotspot?.(hotspot)
            }}
          >
            <Popup className="custom-popup">
              <div className="text-sm font-sans p-0.5 min-w-[220px]">
                <div className="font-bold text-slate-800 mb-1 flex items-center justify-between">
                  <span>Hotspot {hotspot.id}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded text-white ${
                    hotspot.daysAgo === 0 ? 'bg-red-600' : 'bg-orange-600'
                  }`}>
                    {hotspot.daysAgo === 0 ? 'Hari Ini' : `${hotspot.daysAgo} Hari Lalu`}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mb-1">
                  Waktu Satelit (NASA): <span className="font-semibold text-slate-800">{new Date(hotspot.detectedAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} {new Date(hotspot.detectedAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA</span>
                </div>
                <div className="text-xs text-slate-600 mb-1">
                  Tingkat Keyakinan: <span className={hotspot.confidence > 80 ? 'text-red-600 font-bold' : 'text-orange-600 font-bold'}>{hotspot.confidence}%</span>
                </div>
                {hotspot.source && (
                  <div className="text-xs text-slate-600 mb-1">
                    Sumber / Satelit: <span className="font-semibold text-blue-700">{hotspot.source}</span>
                  </div>
                )}

                {/* Smoke Plume Projection Impact Box */}
                {plume && (
                  <div className={`mt-2 p-2 rounded-lg border text-xs ${
                    plume.impacts.severity === 'critical'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : plume.impacts.severity === 'warning'
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="font-bold flex items-center justify-between gap-1 mb-1">
                      <span className="flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5 text-orange-600" />
                        <span>Sebaran Asap: {plume.downwindCardinal}</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold bg-white/80 px-1 py-0.5 rounded border border-current">
                        {plume.windSpeed} km/j
                      </span>
                    </div>
                    <div className="text-[11px] leading-snug">
                      {plume.impacts.summaryText}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 pt-1 border-t border-slate-200/60 font-mono">
                      {plume.impacts.driverVisibilityAdvisory}
                    </div>
                  </div>
                )}

                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${hotspot.location.lat},${hotspot.location.lng}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block text-[11px] font-mono text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1.5 rounded transition-colors mt-2"
                  title="Buka titik koordinat ini di Google Maps"
                >
                  Lat: {hotspot.location.lat.toFixed(5)}<br/>
                  Lng: {hotspot.location.lng.toFixed(5)}
                </a>
                <PopupAddress lat={hotspot.location.lat} lng={hotspot.location.lng} initialAddress={hotspot.address} />
              </div>
            </Popup>
          </Marker>
          );
        })}

        {/* 8. Live Weather Radar Layer (BMKG / RainViewer) with maxNativeZoom={7} to prevent 'zoom not supported' */}
        {showWeatherRadar && radarMetadata?.radarPath && (weatherOverlayMode === "radar" || weatherOverlayMode === "both") && (
          <TileLayer
            key={`radar-${radarMetadata.radarPath}`}
            url={`${radarMetadata.host}${radarMetadata.radarPath}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={radarOpacity}
            zIndex={450}
            maxNativeZoom={7}
            maxZoom={20}
          />
        )}

        {/* 8b. Himawari-9 Geostationary Satellite Infrared Cloud Layer with maxNativeZoom={7} */}
        {showWeatherRadar && radarMetadata?.satellitePath && (weatherOverlayMode === "satellite" || weatherOverlayMode === "both") && (
          <TileLayer
            key={`sat-${radarMetadata.satellitePath}`}
            url={`${radarMetadata.satelliteHost || "https://api.librewxr.net"}${radarMetadata.satellitePath}/256/{z}/{x}/{y}/0/0_0.png`}
            opacity={weatherOverlayMode === "both" ? radarOpacity * 0.75 : radarOpacity}
            zIndex={440}
            maxNativeZoom={7}
            maxZoom={20}
          />
        )}

        {/* 9. Real-Time Wind Flow Vectors along the Corridor */}
        {showWindFlow && CORRIDOR_WIND_POINTS.map((pt) => {
          const wind = getWindForPoint(pt.lng);
          const speed = wind?.windSpeed ?? 12;
          const dir = wind?.windDirection ?? 135;
          const cardinal = wind?.windDirectionCardinal ?? "Tenggara (SE)";
          
          return (
            <Marker
              key={pt.id}
              position={[pt.lat, pt.lng]}
              interactive={true}
              zIndexOffset={300}
              icon={L.divIcon({
                html: `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(15, 23, 42, 0.9); border: 1.5px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="#34d399" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${dir}deg); transition: transform 0.4s ease;">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                      </svg>
                    </div>
                    <div style="margin-top: 2px; padding: 1px 4px; border-radius: 4px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(52, 211, 153, 0.5); color: #34d399; font-size: 9px; font-weight: 800; font-family: monospace; white-space: nowrap; line-height: 1.1;">
                      ${speed} km/j
                    </div>
                  </div>
                `,
                className: "wind-marker-icon",
                iconSize: [40, 44],
                iconAnchor: [20, 22],
              })}
            >
              <Tooltip direction="top" offset={[0, -22]} sticky>
                <div className="p-1 text-xs">
                  <div className="font-bold text-slate-800 flex items-center justify-between gap-2">
                    <span>{pt.name}</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">({speed} km/j)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Arah Tiupan: <span className="font-semibold text-slate-800">{cardinal} ({dir}°)</span>
                  </div>
                  <div className="text-[10px] text-amber-700 mt-1 pt-1 border-t border-slate-200">
                    Perambatan asap & lidah api mengarah ke sebaliknya.
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Quick Focus Controls (Top Left under Zoom) */}
      <div className="absolute top-4 left-14 z-[1000] hidden sm:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg text-xs">
        <button
          onClick={() => setFocusMode("full")}
          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            focusMode === "full" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
          }`}
          title="Fokus Seluruh Koridor (Kelanis Port s/d Tambang)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Seluruh Koridor</span>
        </button>
        <button
          onClick={() => setFocusMode("mine")}
          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            focusMode === "mine" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
          }`}
          title="Fokus Area Tambang IUPK (Tabalong & Balangan)"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>IUPK Tambang</span>
        </button>
        <button
          onClick={() => {
            setMapType("satellite");
            setFocusMode("kelanis");
          }}
          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
            focusMode === "kelanis" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
          }`}
          title="Fokus Area Pelabuhan Kelanis (Sungai Barito)"
        >
          <Anchor className="w-3.5 h-3.5" />
          <span>Area Kelanis (Port)</span>
        </button>
        {onOpenFdrsModal && (
          <button
            onClick={onOpenFdrsModal}
            className="px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 text-amber-300 hover:bg-slate-800 border-l border-slate-700/80 pl-2.5 cursor-pointer"
            title="Buka Status Indeks Kerawanan Karhutla Harian (FDRS)"
          >
            <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Status FDRS</span>
          </button>
        )}
      </div>

      {/* TOP RIGHT: True North Compass (Kompas Orientasi Peta) */}
      <div 
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[1200] pointer-events-auto shadow-2xl rounded-2xl"
        style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1200 }}
      >
        <CompassRose
          onResetOrientation={() => {
            setFocusMode("full");
          }}
        />
      </div>

      {/* Full Detailed Weather Modal */}
      <WeatherModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        stationsData={weatherStationsData}
        selectedStationId={selectedWeatherStationId}
        onSelectStation={setSelectedWeatherStationId}
        onRefresh={loadAllWeather}
        loading={weatherLoading}
        onFlyToStation={(stn) => {
          setFocusMode("none");
          setTargetFly({
            lat: stn.lat,
            lng: stn.lng,
            zoom: 15,
            timestamp: Date.now(),
          });
        }}
      />

      {/* Floating Layer Controls (Mobile Friendly Toggle) */}
      <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 z-[1100] flex flex-col items-end">
        {/* Expanded Panel - compact & constrained so it never cuts off at top */}
        {showLayerPanel && (
          <div className="mb-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-2.5 sm:p-3 rounded-xl shadow-2xl w-[235px] sm:w-[250px] max-w-[calc(100vw-24px)] text-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100vh-140px)] sm:max-h-[min(480px,calc(100vh-120px))] overflow-y-auto">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">Layer & Basemap</span>
              </div>
              <button 
                onClick={() => setShowLayerPanel(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 min-h-[26px] min-w-[26px] flex items-center justify-center cursor-pointer"
                aria-label="Tutup panel layer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Navigation on Mobile */}
            <div className="mb-2 sm:hidden">
              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fokus Wilayah</h4>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => setFocusMode("full")}
                  className="py-1 px-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-200"
                >
                  Semua
                </button>
                <button
                  onClick={() => setFocusMode("mine")}
                  className="py-1 px-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-200"
                >
                  Tambang
                </button>
                <button
                  onClick={() => {
                    setMapType("satellite");
                    setFocusMode("kelanis");
                    setShowLayerPanel(false);
                  }}
                  className="py-1 px-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-center text-slate-200"
                >
                  Kelanis
                </button>
              </div>
            </div>

            {/* Basemap Options */}
            <div className="mb-2.5">
              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Peta Dasar (Basemap)</h4>
              <div className="grid grid-cols-3 gap-1">
                <button 
                  onClick={() => setMapType('street')}
                  className={`py-1 px-1.5 text-[11px] font-semibold rounded-lg border transition-all flex items-center justify-center min-h-[30px] cursor-pointer ${
                    mapType === 'street' 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  title="Peta Jalan Standar OpenStreetMap"
                >
                  Street
                </button>
                <button 
                  onClick={() => setMapType('satellite')}
                  className={`py-1 px-1.5 text-[11px] font-semibold rounded-lg border transition-all flex items-center justify-center min-h-[30px] cursor-pointer ${
                    mapType === 'satellite' 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  title="Satelit Hybrid Google (Tajam & Ada Label)"
                >
                  Satelit HD
                </button>
                <button 
                  onClick={() => setMapType('esri')}
                  className={`py-1 px-1.5 text-[11px] font-semibold rounded-lg border transition-all flex items-center justify-center min-h-[30px] cursor-pointer ${
                    mapType === 'esri' 
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  title="Satelit Esri ArcGIS (Alternatif)"
                >
                  Esri
                </button>
              </div>
            </div>

            {/* Layers Checklist Matching PDF */}
            <div>
              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Layer Peta</h4>
              <div className="space-y-0.5">
                <label className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-slate-800/70 text-[11px] text-slate-200 cursor-pointer select-none min-h-[28px]">
                  <input 
                    type="checkbox" 
                    checked={showIupk} 
                    onChange={(e) => setShowIupk(e.target.checked)} 
                    className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                  /> 
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-3 h-0.5 bg-black inline-block shrink-0"></span>
                    <span>Batas IUPK AI (ESDM)</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-slate-800/70 text-[11px] text-slate-200 cursor-pointer select-none min-h-[28px]">
                  <input 
                    type="checkbox" 
                    checked={showHaulRoad} 
                    onChange={(e) => setShowHaulRoad(e.target.checked)} 
                    className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                  /> 
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-3 h-1 rounded-sm bg-slate-400 inline-block shrink-0"></span>
                    <span>Jalan Hauling (KM 0-71)</span>
                  </span>
                </label>

                {showHaulRoad && (
                  <label className="flex items-center gap-2 py-0.5 px-1.5 ml-3 rounded-md hover:bg-slate-800/70 text-[10px] text-amber-200/90 cursor-pointer select-none min-h-[24px]">
                    <input 
                      type="checkbox" 
                      checked={showMilestones} 
                      onChange={(e) => setShowMilestones(e.target.checked)} 
                      className="accent-amber-500 w-3 h-3 rounded cursor-pointer shrink-0" 
                    /> 
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full border border-amber-400 bg-amber-400 inline-block shrink-0"></span>
                      <span>Penanda Tiap KM</span>
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-slate-800/70 text-[11px] text-slate-200 cursor-pointer select-none min-h-[28px]">
                  <input 
                    type="checkbox" 
                    checked={showBuffer} 
                    onChange={(e) => setShowBuffer(e.target.checked)} 
                    className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                  /> 
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80 inline-block shrink-0"></span>
                    <span>Buffer Zone 1 Km</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-slate-800/70 text-[11px] text-slate-200 cursor-pointer select-none min-h-[28px]">
                  <input 
                    type="checkbox" 
                    checked={showAdmin} 
                    onChange={(e) => setShowAdmin(e.target.checked)} 
                    className="accent-slate-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                  /> 
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-sm border-2 border-white inline-block shrink-0"></span>
                    <span>Batas Wilayah BIG</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-slate-800/70 text-[11px] text-slate-200 cursor-pointer select-none min-h-[28px]">
                  <input 
                    type="checkbox" 
                    checked={showHotspots} 
                    onChange={(e) => setShowHotspots(e.target.checked)} 
                    className="accent-red-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                  /> 
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0"></span>
                    <span>Titik Api (Hotspots)</span>
                  </span>
                </label>

                {/* Heatmap Density Layer Toggle */}
                <div className="bg-slate-800/40 rounded-lg p-1.5 border border-slate-700/60 mt-1">
                  <label className="flex items-center justify-between gap-2 text-[11px] text-slate-200 cursor-pointer select-none">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Heatmap Kepadatan Hotspot</span>
                    </span>
                    <input 
                      type="checkbox" 
                      checked={showHeatmap} 
                      onChange={(e) => setShowHeatmap(e.target.checked)} 
                      className="accent-rose-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                    /> 
                  </label>

                  {showHeatmap && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase">
                        <span>Radius Klaster:</span>
                        <span className="text-rose-400 font-mono font-bold">
                          {heatmapRadius === 20 ? "Ketat (20px)" : heatmapRadius === 28 ? "Normal (28px)" : "Lebar (38px)"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { label: "Ketat", r: 20, b: 14 },
                          { label: "Normal", r: 28, b: 18 },
                          { label: "Lebar", r: 38, b: 24 }
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setHeatmapRadius(preset.r);
                              setHeatmapBlur(preset.b);
                            }}
                            className={`py-0.5 text-[10px] font-semibold rounded border transition-all cursor-pointer ${
                              heatmapRadius === preset.r
                                ? "bg-rose-600 border-rose-400 text-white shadow-sm"
                                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 pt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block shrink-0" />
                        <span>Cyan (Rendah)</span>
                        <span className="text-slate-600">→</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
                        <span className="text-rose-400 font-bold">Merah (Klaster Padat)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Weather & Satellite Layer Controls */}
              <div className="pt-2 mt-2 border-t border-slate-800">
                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Overlay Cuaca & Satelit
                </h4>
                <div className="space-y-1">
                  <div className="bg-slate-800/50 rounded-lg p-1.5 border border-slate-700/60">
                    <label className="flex items-center justify-between gap-2 text-[11px] text-slate-200 cursor-pointer select-none">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Satellite className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>Radar Hujan & Awan Himawari</span>
                      </span>
                      <input 
                        type="checkbox" 
                        checked={showWeatherRadar} 
                        onChange={(e) => {
                          setShowWeatherRadar(e.target.checked);
                          if (e.target.checked && !radarMetadata) {
                            fetchRainViewerRadar().then((meta) => meta && setRadarMetadata(meta));
                          }
                        }} 
                        className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                      /> 
                    </label>

                    {showWeatherRadar && (
                      <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-1.5">
                        <div className="text-[9px] text-slate-400 font-semibold uppercase">Pilihan Lapisan:</div>
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => setWeatherOverlayMode("radar")}
                            className={`py-1 px-1 text-[10px] font-semibold rounded border transition-all cursor-pointer ${
                              weatherOverlayMode === "radar"
                                ? "bg-blue-600 border-blue-400 text-white"
                                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                            title="Presipitasi / Curah Hujan Real-Time"
                          >
                            Radar Hujan
                          </button>
                          <button
                            type="button"
                            onClick={() => setWeatherOverlayMode("satellite")}
                            className={`py-1 px-1 text-[10px] font-semibold rounded border transition-all cursor-pointer ${
                              weatherOverlayMode === "satellite"
                                ? "bg-blue-600 border-blue-400 text-white"
                                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                            title="Citra Awan Inframerah Satelit Himawari-9"
                          >
                            Himawari IR
                          </button>
                          <button
                            type="button"
                            onClick={() => setWeatherOverlayMode("both")}
                            className={`py-1 px-1 text-[10px] font-semibold rounded border transition-all cursor-pointer ${
                              weatherOverlayMode === "both"
                                ? "bg-blue-600 border-blue-400 text-white"
                                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                            title="Tampilkan Radar Hujan Sekaligus Citra Awan Satelit"
                          >
                            Kombinasi
                          </button>
                        </div>

                        {/* Opacity slider */}
                        <div className="flex items-center justify-between gap-1.5 pt-1">
                          <span className="text-[9px] text-slate-400">Opasitas:</span>
                          <input
                            type="range"
                            min="0.3"
                            max="0.95"
                            step="0.05"
                            value={radarOpacity}
                            onChange={(e) => setRadarOpacity(parseFloat(e.target.value))}
                            className="w-20 accent-blue-500 h-1 bg-slate-700 rounded cursor-pointer"
                          />
                          <span className="text-[9px] font-mono text-slate-300 w-6 text-right">
                            {Math.round(radarOpacity * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-slate-800/70 text-[11px] text-slate-200 cursor-pointer select-none min-h-[28px]">
                    <input 
                      type="checkbox" 
                      checked={showWindFlow} 
                      onChange={(e) => setShowWindFlow(e.target.checked)} 
                      className="accent-emerald-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                    /> 
                    <span className="flex items-center gap-1.5 truncate">
                      <Wind className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Vektor Tiupan Angin</span>
                    </span>
                  </label>

                  {/* Smoke Plume Projection Layer */}
                  <div className="bg-slate-800/50 rounded-lg p-1.5 border border-slate-700/60 mt-1">
                    <label className="flex items-center justify-between gap-2 text-[11px] text-slate-200 cursor-pointer select-none">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>Proyeksi Sebaran Asap</span>
                      </span>
                      <input 
                        type="checkbox" 
                        checked={showSmokePlume} 
                        onChange={(e) => setShowSmokePlume(e.target.checked)} 
                        className="accent-orange-500 w-3.5 h-3.5 rounded cursor-pointer shrink-0" 
                      /> 
                    </label>

                    {showSmokePlume && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase">
                          <span>Waktu Dispersi:</span>
                          <span className="text-orange-400 font-mono font-bold">{smokePlumeHours} Jam</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {([1, 2, 3] as const).map((hrs) => (
                            <button
                              key={hrs}
                              type="button"
                              onClick={() => setSmokePlumeHours(hrs)}
                              className={`py-0.5 text-[10px] font-semibold rounded border transition-all cursor-pointer ${
                                smokePlumeHours === hrs
                                  ? "bg-orange-600 border-orange-400 text-white shadow-sm"
                                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                              }`}
                            >
                              {hrs} Jam
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Quick Heatmap Toggle Button */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`h-9 px-3 rounded-full border shadow-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all min-h-[36px] active:scale-95 cursor-pointer select-none ${
            showHeatmap
              ? "bg-rose-600 border-rose-400 text-white shadow-rose-600/40"
              : "bg-slate-900/90 backdrop-blur-md border-slate-700 text-slate-200 hover:bg-slate-800"
          }`}
          title="Nyalakan / Matikan Heatmap Kepadatan Hotspot (Klaster)"
        >
          <Flame className={`w-4 h-4 ${showHeatmap ? "text-amber-300 animate-pulse" : "text-orange-400"}`} />
          <span className="hidden sm:inline">Heatmap Klaster</span>
          <span className="sm:hidden">Heatmap</span>
          {showHeatmap && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        {/* Floating Toggle Button */}
        <button
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          className={`h-9 px-3 rounded-full border shadow-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all min-h-[36px] active:scale-95 cursor-pointer ${
            showLayerPanel 
              ? 'bg-blue-600 border-blue-400 text-white' 
              : 'bg-slate-900/90 backdrop-blur-md border-slate-700 text-slate-200 hover:bg-slate-800'
          }`}
          title="Pengaturan Layer & Basemap"
          aria-label="Toggle Layers"
        >
          <Layers className="w-4 h-4" />
          <span>Layer & Peta</span>
        </button>
      </div>

      {/* Emergency Alert Banner */}
      {showHotspots && newHotspots.length > 0 && !alertDismissed && (
        <div className="absolute top-20 inset-x-3 sm:inset-x-auto sm:right-4 sm:top-20 sm:max-w-sm bg-red-600/95 backdrop-blur-sm text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-red-400/50 flex items-center gap-3 z-[1000] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-red-200">Peringatan Darurat</div>
            <div className="text-xs sm:text-sm font-bold truncate">Titik Api Baru Terdeteksi</div>
            <div className="text-[11px] opacity-90 font-mono">
              {newHotspots.length} hotspot baru terdeteksi
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {latestNewHotspot && (
              <button
                onClick={() => handleViewHotspot(latestNewHotspot)}
                className="px-2.5 py-1.5 bg-white text-red-700 text-xs font-bold rounded-lg hover:bg-red-50 active:scale-95 transition-all flex items-center gap-1 min-h-[36px] shadow-sm cursor-pointer"
                title="Langsung zoom in ke lokasi titik api"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Lihat</span>
              </button>
            )}
            <button
              onClick={() => setAlertDismissed(true)}
              className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom-Left Overlays Container: Heatmap Cluster Legend & Weather Radar (Side-by-side, No Overlap) */}
      {(showHeatmap || showWeatherRadar) && (
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-[900] flex flex-col sm:flex-row items-start sm:items-end gap-2.5 pointer-events-none max-w-[calc(100vw-220px)]">
          {/* Heatmap Density Legend Bar */}
          {showHeatmap && (
            <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-2xl flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200 shrink-0">
              <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px]">
                <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span className="hidden xs:inline">Klaster Hotspot:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-mono">Rendah</span>
                <div className="w-20 sm:w-28 h-2.5 rounded-full shadow-inner bg-gradient-to-r from-cyan-500 via-emerald-400 via-yellow-400 via-orange-500 to-rose-600 border border-white/20" />
                <span className="text-[10px] text-rose-400 font-mono font-bold">Padat</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline border-l border-slate-700 pl-2">
                ({heatmapPoints.length} titik)
              </span>
              <button
                onClick={() => setShowHeatmap(false)}
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors ml-0.5 cursor-pointer"
                title="Nonaktifkan Heatmap"
                aria-label="Tutup Heatmap"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Weather Radar Legend (Side-by-side next to Heatmap) */}
          {showWeatherRadar && (
            <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl shadow-2xl text-xs text-slate-200 min-w-[240px] sm:min-w-[260px] animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between gap-2 mb-1.5 font-bold text-[11px] text-blue-400">
                <div className="flex items-center gap-1.5">
                  <Satellite className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span>
                    {weatherOverlayMode === "satellite"
                      ? "Satelit Himawari-9 (Awan IR)"
                      : weatherOverlayMode === "both"
                      ? "Radar Hujan + Himawari-9"
                      : "Radar Hujan Live (Presipitasi)"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    Live WITA
                  </span>
                  <button
                    onClick={() => setShowWeatherRadar(false)}
                    className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Sembunyikan Overlay Radar"
                    aria-label="Tutup Radar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {weatherOverlayMode !== "satellite" ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                    <span className="text-slate-400">Gerimis</span>
                    <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-cyan-400 via-green-400 via-yellow-400 to-red-600"></div>
                    <span className="text-slate-400">Lebat / Badai</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                    <span className="text-slate-400">Cerah</span>
                    <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-slate-800 via-slate-500 via-slate-300 to-white"></div>
                    <span className="text-slate-400">Awan Tebal / CB</span>
                  </div>
                </div>
              )}

              <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span>Resolusi Adaptif (Auto-Scaled HD)</span>
                <button
                  onClick={() => {
                    fetchRainViewerRadar().then((meta) => meta && setRadarMetadata(meta));
                  }}
                  className="text-blue-400 hover:text-blue-300 cursor-pointer underline"
                  title="Perbarui data radar"
                >
                  Update
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
