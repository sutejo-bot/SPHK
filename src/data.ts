import * as turf from "@turf/turf";
import { Coordinates } from "./types";
import { findNearestLocalVillage } from "./villageData";
import { generateHotspotIdFromNasa } from "./utils";

// Official ESDM Minerba SK IUPK No. 11/1/IUP/PMA/2022 (PT Adaro Indonesia)
// Luas SK: 23.942 Ha, Komoditas: Batubara, Lokasi: Tabalong & Balangan, Kalsel
export const ADARO_IUPK_COORDINATES: Coordinates[] = [
  { lat: -2.2825696480499404, lng: 115.4752835967584 },
  { lat: -2.3218067302063354, lng: 115.4752835967584 },
  { lat: -2.3218067302063354, lng: 115.51638888898883 },
  { lat: -2.2554278457186077, lng: 115.51638888898883 },
  { lat: -2.2468888887967924, lng: 115.51638888898883 },
  { lat: -2.2468888887967924, lng: 115.5163899993065 },
  { lat: -2.2468888887967924, lng: 115.56638888863253 },
  { lat: -2.2192599111634586, lng: 115.56638888863253 },
  { lat: -2.213555556243749, lng: 115.56638888863253 },
  { lat: -2.213555556243749, lng: 115.59394149400416 },
  { lat: -2.213555556243749, lng: 115.59972222202774 },
  { lat: -2.1509025002263154, lng: 115.59972222202774 },
  { lat: -2.1509025002263154, lng: 115.60536111055956 },
  { lat: -2.133341666680506, lng: 115.60536111055956 },
  { lat: -2.133341666680506, lng: 115.56803055622096 },
  { lat: -2.1333083326585105, lng: 115.56803055622096 },
  { lat: -2.130194443654375, lng: 115.56803055622096 },
  { lat: -2.130194443654375, lng: 115.56638888863253 },
  { lat: -2.1468611108878113, lng: 115.56638888863253 },
  { lat: -2.1468611108878113, lng: 115.5580555564066 },
  { lat: -2.163527777709798, lng: 115.5580555564066 },
  { lat: -2.163527777709798, lng: 115.54972222238406 },
  { lat: -2.171861110748985, lng: 115.54972222238406 },
  { lat: -2.171861110748985, lng: 115.5413888892598 },
  { lat: -2.1745919998875682, lng: 115.5413888892598 },
  { lat: -2.1801944436037757, lng: 115.5413888892598 },
  { lat: -2.1801944436037757, lng: 115.53847999974109 },
  { lat: -2.1801944436037757, lng: 115.52472222211306 },
  { lat: -2.1885159996953294, lng: 115.52472222211306 },
  { lat: -2.1885159996953294, lng: 115.5080555558646 },
  { lat: -2.171861110748985, lng: 115.5080555558646 },
  { lat: -2.171861110748985, lng: 115.51638888898883 },
  { lat: -2.155194443765375, lng: 115.51638888898883 },
  { lat: -2.155194443765375, lng: 115.52472222211306 },
  { lat: -2.138527778356241, lng: 115.52472222211306 },
  { lat: -2.138527778356241, lng: 115.5330555561356 },
  { lat: -2.124327036616994, lng: 115.5330555561356 },
  { lat: -2.121861111447412, lng: 115.5330555561356 },
  { lat: -2.121861111447412, lng: 115.44972399996429 },
  { lat: -2.121861111447412, lng: 115.44972222219835 },
  { lat: -2.130191000098266, lng: 115.44972222219835 },
  { lat: -2.130194443654375, lng: 115.44972222219835 },
  { lat: -2.130194443654375, lng: 115.43305700044084 },
  { lat: -2.130194443654375, lng: 115.43305555594988 },
  { lat: -2.1638916196741063, lng: 115.43305555594988 },
  { lat: -2.1680277768038945, lng: 115.43305555594988 },
  { lat: -2.1680277768038945, lng: 115.4441666667822 },
  { lat: -2.236388889698488, lng: 115.4441666667822 },
  { lat: -2.236388889698488, lng: 115.43305555594988 },
  { lat: -2.246833333012188, lng: 115.43305555594988 },
  { lat: -2.246833333012188, lng: 115.44724163593234 },
  { lat: -2.2511050812428604, lng: 115.44724163593234 },
  { lat: -2.2511050812428604, lng: 115.45979846663681 },
  { lat: -2.254990108102434, lng: 115.45979846663681 },
  { lat: -2.254990108102434, lng: 115.46652982064016 },
  { lat: -2.2641102468968204, lng: 115.46652982064016 },
  { lat: -2.2641102468968204, lng: 115.48618409397908 },
  { lat: -2.2825696480499404, lng: 115.48618409397908 },
  { lat: -2.2825696480499404, lng: 115.4752835967584 }
];

// Dahai - Jalan Jenderal Achmad Yani Corridor & Facilities Buffer Extension
export const DAHAI_CORRIDOR_BUFFER_COORDINATES: Coordinates[] = [
  { lat: -2.2350, lng: 115.4400 },
  { lat: -2.2920, lng: 115.4400 }, // Garis vertikal di batas barat
  { lat: -2.2920, lng: 115.4880 }, // Sisi selatan terhubung ke buffer IUPK Paringin
  { lat: -2.2640, lng: 115.4880 }, // Sisi timur terhubung ke batas IUPK
  { lat: -2.2640, lng: 115.4780 },
  { lat: -2.2350, lng: 115.4750 }, // Sisi utara terhubung ke buffer IUPK Dahai
  { lat: -2.2350, lng: 115.4400 }, // Menutup poligon
];

export const dahaiBufferPolygon = turf.polygon([[
  ...DAHAI_CORRIDOR_BUFFER_COORDINATES.map(c => [c.lng, c.lat])
]]);

// Function to calculate unified 1 km buffer around the IUPK and Dahai facilities corridor
export function createCombinedBuffer(poly: any): any {
  if (!poly) return dahaiBufferPolygon;
  try {
    const baseBuffer = turf.buffer(poly, 1.0, { units: 'kilometers' });
    if (!baseBuffer) return dahaiBufferPolygon;
    const unioned = turf.union(turf.featureCollection([
      baseBuffer as any, 
      dahaiBufferPolygon as any
    ])) as any;
    return unioned || baseBuffer;
  } catch {
    try {
      return turf.buffer(poly, 1.0, { units: 'kilometers' }) || dahaiBufferPolygon;
    } catch {
      return dahaiBufferPolygon;
    }
  }
}

// Convert to Turf Polygon (lng, lat format)
const iupkCoordsForTurf = ADARO_IUPK_COORDINATES.map(c => [c.lng, c.lat]);
export let iupkPolygon = turf.polygon([[...iupkCoordsForTurf]]);

// Calculate 1 km buffer combined with Dahai corridor extension
export let iupkBuffer = createCombinedBuffer(iupkPolygon);

export interface IUPKMetadata {
  nama_usaha: string;
  badan_usah?: string;
  sk_iup?: string;
  luas_sk?: number;
  kegiatan?: string;
  jenis_izin?: string;
  komoditas?: string;
  nama_prov?: string;
  nama_kab?: string;
  kode_wiup?: string;
  pejabat?: string;
  tgl_berlak?: number;
  tgl_akhir?: number;
}

export let iupkMetadata: IUPKMetadata = {
  nama_usaha: "Konsesi IUPK Operasi Produksi",
  badan_usah: "",
  sk_iup: "11/1/IUP/PMA/2022",
  luas_sk: 23942,
  kegiatan: "OPERASI PRODUKSI",
  jenis_izin: "IUPK",
  komoditas: "BATUBARA",
  nama_prov: "KALIMANTAN SELATAN",
  nama_kab: "TABALONG, BALANGAN",
  kode_wiup: "1300003032014132",
  pejabat: "MENTERI",
};

export function updateIupkBoundaries(geoJsonFeatureOrPolygon: any, properties?: any) {
  if (!geoJsonFeatureOrPolygon) return;
  iupkPolygon = geoJsonFeatureOrPolygon;
  iupkBuffer = createCombinedBuffer(iupkPolygon);
  if (properties) {
    iupkMetadata = {
      ...iupkMetadata,
      ...properties,
    };
  }
}

export async function fetchDynamicIUPKBoundary(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch("/api/iupk", { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    
    // Look for features in GeoJSON FeatureCollection
    if (data && data.features && Array.isArray(data.features) && data.features.length > 0) {
      // Find feature matching Adaro Indonesia or take the first feature
      const adaroFeature = data.features.find((f: any) => {
        const name = (f.properties?.nama_usaha || f.properties?.badan_usah || f.properties?.nama_ppkh || "").toUpperCase();
        return name.includes("ADARO");
      }) || data.features[0];

      if (adaroFeature && adaroFeature.geometry) {
        const geomType = adaroFeature.geometry.type;
        const coords = adaroFeature.geometry.coordinates;

        // Ensure geometry has coordinates
        if ((geomType === "Polygon" || geomType === "MultiPolygon") && coords && coords.length > 0) {
          updateIupkBoundaries(adaroFeature, adaroFeature.properties);
          console.log("Successfully loaded official IUPK boundary from ESDM Geoportal:", {
            sk: adaroFeature.properties?.sk_iup || "11/1/IUP/PMA/2022",
            perusahaan: adaroFeature.properties?.nama_usaha || "Konsesi IUPK",
            luas_sk: adaroFeature.properties?.luas_sk || 23942,
            type: geomType,
            points: geomType === "Polygon" ? coords[0]?.length : coords[0]?.[0]?.length,
          });
          return;
        }
      }
    }
    throw new Error("Invalid GeoJSON structure returned from API");
  } catch (error) {
    console.warn("Notice: Could not fetch dynamic IUPK boundary from /api/iupk, keeping high-precision official ESDM fallback.", error);
  }
}

export function getIupkCoordinates(): Coordinates[][] {
  if (!iupkPolygon || !iupkPolygon.geometry) {
    return [ADARO_IUPK_COORDINATES];
  }
  if (iupkPolygon.geometry.type === "Polygon") {
    return [iupkPolygon.geometry.coordinates[0].map(
      (coord: any) => ({ lat: coord[1], lng: coord[0] })
    )];
  } else if (iupkPolygon.geometry.type === "MultiPolygon") {
    return iupkPolygon.geometry.coordinates.map((poly: any) => 
      poly[0].map((coord: any) => ({ lat: coord[1], lng: coord[0] }))
    );
  }
  return [ADARO_IUPK_COORDINATES];
}

// Get buffer coordinates for Leaflet Map
export function getBufferCoordinates(): Coordinates[][] {
  if (!iupkBuffer || !iupkBuffer.geometry) {
    return [DAHAI_CORRIDOR_BUFFER_COORDINATES];
  }
  if (iupkBuffer.geometry.type === "Polygon") {
    return [iupkBuffer.geometry.coordinates[0].map(
      (coord: any) => ({ lat: coord[1], lng: coord[0] })
    )];
  } else if (iupkBuffer.geometry.type === "MultiPolygon") {
    return iupkBuffer.geometry.coordinates.map((poly: any) => 
      poly[0].map((coord: any) => ({ lat: coord[1], lng: coord[0] }))
    );
  }
  return [DAHAI_CORRIDOR_BUFFER_COORDINATES];
}

export function getHaulRoadBufferCoordinates(): Coordinates[][] {
  const targetBuffer = unifiedHaulRoadAndKelanisBuffer || haulRoadBuffer;
  if (!targetBuffer) return [];
  if (targetBuffer.geometry.type === "Polygon") {
    return [targetBuffer.geometry.coordinates[0].map(
      (coord: any) => ({ lat: coord[1], lng: coord[0] })
    )];
  } else if (targetBuffer.geometry.type === "MultiPolygon") {
    return targetBuffer.geometry.coordinates.map((poly: any) => 
      poly[0].map((coord: any) => ({ lat: coord[1], lng: coord[0] }))
    );
  }
  return [];
}

import {
  ADARO_HAUL_ROAD_COORDINATES,
  KELANIS_PORT_COORDINATES,
} from "./adaroSecurityData";
import { HaulRoadMilestone } from "./types";

// Haul road corridor buffer (1 kilometer along haul road)
const haulRoadLine = turf.lineString(ADARO_HAUL_ROAD_COORDINATES.map(([lat, lng]) => [lng, lat]));
export const haulRoadBuffer = turf.buffer(haulRoadLine, 1.0, { units: 'kilometers' });

// Poligon Area Pelabuhan Khusus Batubara Kelanis (Sungai Barito - KM 0)
export const kelanisPortPolygon = turf.polygon([[
  ...KELANIS_PORT_COORDINATES.map(([lt, lg]) => [lg, lt]),
  [KELANIS_PORT_COORDINATES[0][1], KELANIS_PORT_COORDINATES[0][0]]
]]);

// Buffer 1 KM Area Kelanis Port (melingkupi Sungai Barito & dermaga pengapalan tongkang)
export const kelanisPortBuffer = turf.buffer(kelanisPortPolygon, 1.0, { units: 'kilometers' });

// Penggabungan (Union) Buffer 1 KM Hauling Road dan Buffer 1 KM Kelanis Port
export const unifiedHaulRoadAndKelanisBuffer = (() => {
  try {
    const unioned = turf.union(turf.featureCollection([haulRoadBuffer, kelanisPortBuffer]));
    return unioned || haulRoadBuffer;
  } catch (err) {
    return haulRoadBuffer;
  }
})();

export function getKelanisPortCoordinates(): Coordinates[] {
  return KELANIS_PORT_COORDINATES.map(([lat, lng]) => ({ lat, lng }));
}

// Pre-calculated milestone markers per 1 km along the hauling road
export const ADARO_HAUL_ROAD_MILESTONES: HaulRoadMilestone[] = (() => {
  const totalLength = turf.length(haulRoadLine, { units: "kilometers" });
  const milestones: HaulRoadMilestone[] = [];

  for (let km = 0; km <= Math.floor(totalLength); km++) {
    const pt = turf.along(haulRoadLine, km, { units: "kilometers" });
    const [lng, lat] = pt.geometry.coordinates;
    milestones.push({
      km,
      label: `KM ${km}`,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      isMajor: km % 5 === 0,
      description: km === 0 ? "Terminal Batubara Kelanis (KM 0)" : `Jalur Hauling Road KM ${km}`
    });
  }

  // End point (coordinate: -2.248066, 115.451902)
  const lastCoord = ADARO_HAUL_ROAD_COORDINATES[ADARO_HAUL_ROAD_COORDINATES.length - 1];
  const finalKm = Number(totalLength.toFixed(1));
  if (totalLength - Math.floor(totalLength) > 0.05) {
    milestones.push({
      km: finalKm,
      label: `KM ${finalKm}`,
      lat: Number(lastCoord[0].toFixed(5)),
      lng: Number(lastCoord[1].toFixed(5)),
      isMajor: true,
      description: `Batas Akhir Segmen Hauling Road (KM ${finalKm})`
    });
  }

  return milestones;
})();

export function checkHotspotZone(lat: number, lng: number): "iupk" | "buffer" | "outside" {
  const point = turf.point([lng, lat]);
  if (turf.booleanPointInPolygon(point, iupkPolygon)) {
    return "iupk";
  }
  // Check if in Kelanis Port area
  if (turf.booleanPointInPolygon(point, kelanisPortPolygon)) {
    return "iupk";
  }
  // Check 1 km buffer of IUPK (which includes Dahai corridor buffer) or Haul Road + Kelanis
  if (turf.booleanPointInPolygon(point, iupkBuffer)) {
    return "buffer";
  }
  if (turf.booleanPointInPolygon(point, unifiedHaulRoadAndKelanisBuffer)) {
    return "buffer";
  }
  // Explicit safeguard for Dahai - Jalan Jenderal Achmad Yani corridor buffer
  if (turf.booleanPointInPolygon(point, dahaiBufferPolygon)) {
    return "buffer";
  }
  return "outside";
}

// Generate some random initial hotspots for demonstration (fallback)
export function generateRandomHotspot() {
  // Generate random point near the IUPK
  const centerLat = -2.20;
  const centerLng = 115.47;
  
  const latOffset = (Math.random() - 0.5) * 0.15;
  const lngOffset = (Math.random() - 0.5) * 0.15;
  
  const lat = centerLat + latOffset;
  const lng = centerLng + lngOffset;
  
  return {
    lat,
    lng,
    confidence: Math.floor(Math.random() * 30) + 70, // 70 to 99%
  };
}

import Papa from "papaparse";
import { Hotspot, HotspotTimeRange } from "./types";

export function identifyHotspotSource(rowOrSat: any, instrumentArg?: string): {
  source: string;
  satellite: string;
  agency: string;
} {
  let sat = "";
  let inst = "";

  if (typeof rowOrSat === "string") {
    sat = rowOrSat.trim();
    inst = String(instrumentArg || "").trim();
  } else if (rowOrSat && typeof rowOrSat === "object") {
    sat = String(rowOrSat.satellite || "").trim();
    inst = String(rowOrSat.instrument || instrumentArg || "").trim();
  }

  // Himawari-8 / Himawari-9 (JMA / JAXA Jepang & BMKG)
  if (sat.toLowerCase().includes("himawari") || sat === "H08" || sat === "H09" || inst.toLowerCase().includes("ahi")) {
    return {
      source: "Satelit Jepang: Himawari-9 (JMA & BMKG)",
      satellite: "Himawari-9 (Jepang)",
      agency: "JMA / BMKG",
    };
  }

  // Suomi-NPP (VIIRS) - digunakan SiPongi+ KLHK & NASA
  if (sat === "N" || sat.toLowerCase().includes("snpp") || sat.toLowerCase().includes("suomi")) {
    return {
      source: "SiPongi+ KLHK & NASA: Suomi-NPP (VIIRS)",
      satellite: "Suomi-NPP",
      agency: "SiPongi+ (KLHK) / NASA",
    };
  }

  // NOAA-20 / JPSS-1 (VIIRS) - digunakan BRIN INDOFIRMS & BMKG
  if (sat === "N20" || sat.toLowerCase().includes("noaa-20") || sat.toLowerCase().includes("j01")) {
    return {
      source: "BRIN INDOFIRMS & BMKG: NOAA-20 (VIIRS)",
      satellite: "NOAA-20",
      agency: "BRIN / BMKG",
    };
  }

  // NOAA-21 / JPSS-2 (VIIRS) - digunakan SiPongi+ KLHK & BRIN
  if (sat === "N21" || sat.toLowerCase().includes("noaa-21") || sat.toLowerCase().includes("j02")) {
    return {
      source: "SiPongi+ KLHK & BRIN: NOAA-21 (VIIRS)",
      satellite: "NOAA-21",
      agency: "SiPongi+ / BRIN",
    };
  }

  // MODIS Aqua (NASA & BMKG)
  if (sat.toLowerCase().includes("aqua") || (inst === "MODIS" && sat.toLowerCase().includes("a"))) {
    return {
      source: "BMKG & NASA: Aqua (MODIS)",
      satellite: "Aqua",
      agency: "BMKG / NASA",
    };
  }

  // MODIS Terra (SiPongi+ KLHK & NASA)
  if (sat.toLowerCase().includes("terra") || (inst === "MODIS" && sat.toLowerCase().includes("t"))) {
    return {
      source: "SiPongi+ KLHK & NASA: Terra (MODIS)",
      satellite: "Terra",
      agency: "SiPongi+ / NASA",
    };
  }

  // Landsat-8 / Landsat-9 (BRIN & USGS)
  if (sat.toLowerCase().includes("landsat") || sat === "L8" || sat === "L9" || inst.toLowerCase().includes("oli") || inst.toLowerCase().includes("tirs")) {
    return {
      source: "BRIN & USGS: Landsat-8/9 (TIRS)",
      satellite: "Landsat-8/9",
      agency: "BRIN / USGS",
    };
  }

  // Generic fallback if column format differs
  if (inst === "VIIRS") {
    return {
      source: "SiPongi+ KLHK / BRIN: VIIRS",
      satellite: "VIIRS",
      agency: "SiPongi+ / BRIN",
    };
  }

  if (inst === "MODIS") {
    return {
      source: "BMKG & NASA: MODIS",
      satellite: "MODIS",
      agency: "BMKG / NASA",
    };
  }

  return {
    source: "Multi-Satelit Terpadu (Jepang / BRIN / SiPongi / BMKG)",
    satellite: "Multi-Satelit",
    agency: "Terintegrasi",
  };
}

export async function fetchNasaHotspots(range: HotspotTimeRange = 1): Promise<Hotspot[]> {
  try {
    const apiParam = range === "now" || range === "12h" || range === 1 ? 2 : range;
    const response = await fetch(`/api/hotspots?days=${apiParam}`);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("NASA_API_KEY is missing or invalid");
      }
      throw new Error(`Server API error: ${response.status}`);
    }
    
    const csvData = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const hotspots: Hotspot[] = [];
          const seenIds = new Set<string>();
          const nowD = new Date();
          const todayUTC = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), nowD.getUTCDate()));
          
          results.data.forEach((row: any) => {
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            const zone = checkHotspotZone(lat, lng);
            if (zone === "outside") return;

            // VIIRS confidence is 'n' (nominal/medium), 'l' (low), 'h' (high)
            // MODIS confidence is 0-100
            let confidence = 50;
            if (row.confidence === 'h') confidence = 95;
            else if (row.confidence === 'n') confidence = 75;
            else if (row.confidence === 'l') confidence = 30;
            else if (!isNaN(parseInt(row.confidence))) confidence = parseInt(row.confidence);

            const acqDate = row.acq_date || ""; // YYYY-MM-DD
            const acqTime = row.acq_time || ""; // HHMM (UTC)
            
            let detectedAt = new Date();
            let daysAgo = 0;
            if (acqDate) {
              const parts = acqDate.split("-").map(Number);
              if (parts.length === 3) {
                const acqD = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
                daysAgo = Math.max(0, Math.floor((todayUTC.getTime() - acqD.getTime()) / (1000 * 60 * 60 * 24)));
              }
              if (acqTime) {
                const hours = acqTime.padStart(4, "0").substring(0, 2);
                const mins = acqTime.padStart(4, "0").substring(2, 4);
                detectedAt = new Date(`${acqDate}T${hours}:${mins}:00Z`);
              } else {
                detectedAt = new Date(`${acqDate}T00:00:00Z`);
              }
            }

            // Identify satellite & agency source info
            const sourceInfo = identifyHotspotSource(row);

            // Deterministic unique ID based on NASA timestamp: Hari, Tanggal, dan Jam (WITA)
            const baseId = generateHotspotIdFromNasa(acqDate, acqTime);
            
            let id = baseId;
            let counter = 1;
            while (seenIds.has(id)) {
              counter++;
              id = `${baseId}-${counter}`;
            }
            seenIds.add(id);

            hotspots.push({
              id,
              location: { lat, lng },
              confidence,
              detectedAt,
              status: daysAgo === 0 ? "new" : "acknowledged", // Detections from today default to 'new'
              zone,
              acqDate,
              daysAgo,
              address: findNearestLocalVillage(lat, lng) || undefined,
              source: sourceInfo.source,
              satellite: sourceInfo.satellite,
              agency: sourceInfo.agency,
            });
          });
          
          // Sort by newest detectedAt first
          hotspots.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
          
          // Filter by time range if "now" or "12h"
          let filteredHotspots = hotspots;
          const nowMs = Date.now();

          if (range === "now") {
            // Hotspot saat ini: pass satelit terkini (toleransi 2 jam terakhir untuk "saat ini")
            filteredHotspots = hotspots.filter(h => nowMs - h.detectedAt.getTime() <= 2 * 60 * 60 * 1000 && nowMs >= h.detectedAt.getTime());
          } else if (range === "12h") {
            // Hotspot 12 jam yang lalu: strictly 12 jam terakhir dari saat ini
            const twelveHoursAgo = nowMs - 12 * 60 * 60 * 1000;
            filteredHotspots = hotspots.filter(h => h.detectedAt.getTime() >= twelveHoursAgo && h.detectedAt.getTime() <= nowMs);
          } else if (range === 1) {
            // Hotspot 1 hari yang lalu: strictly 24 jam terakhir dari saat ini
            const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
            filteredHotspots = hotspots.filter(h => h.detectedAt.getTime() >= oneDayAgo && h.detectedAt.getTime() <= nowMs);
          }

          resolve(filteredHotspots);
        },
        error: (err: any) => {
          reject(err);
        }
      });
    });
  } catch (error) {
    throw error;
  }
}
