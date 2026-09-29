import * as turf from "@turf/turf";
import { Hotspot, Coordinates } from "./types";
import { 
  ADARO_HAUL_ROAD_COORDINATES, 
  KELANIS_PORT_COORDINATES 
} from "./adaroSecurityData";
import { ADARO_HAUL_ROAD_MILESTONES } from "./data";
import { CORRIDOR_WIND_POINTS, CurrentWeather } from "./weatherData";
import { findNearestLocalVillage } from "./villageData";

export interface SmokeConeRings {
  oneHour: [number, number][]; // [lat, lng] array
  twoHour: [number, number][];
  threeHour: [number, number][];
}

export interface SmokePlumeAnalysis {
  hotspotId: string;
  origin: Coordinates;
  windSpeed: number; // km/h
  windDirection: number; // 0-360 deg (where wind comes from)
  windCardinal: string;
  downwindDirection: number; // 0-360 deg (where smoke drifts TO)
  downwindCardinal: string;
  coneRings: SmokeConeRings;
  centerline: [number, number][]; // [lat, lng]
  impacts: {
    affectsHaulRoad: boolean;
    affectedKmRange?: string; // e.g. "KM 32 - KM 36"
    nearestHaulRoadKm?: number;
    distanceToHaulRoadKm?: number;
    affectsKelanisPort: boolean;
    affectsMineIupk: boolean;
    affectedVillages: string[];
    severity: "critical" | "warning" | "advisory" | "low";
    summaryText: string;
    driverVisibilityAdvisory: string;
  };
}

// Haul road turf line for fast geometric intersection
const haulRoadLine = turf.lineString(
  ADARO_HAUL_ROAD_COORDINATES.map(([lat, lng]) => [lng, lat])
);

// Kelanis Port polygon for intersection
const kelanisPolygon = turf.polygon([[
  ...KELANIS_PORT_COORDINATES.map(([lat, lng]) => [lng, lat]),
  [KELANIS_PORT_COORDINATES[0][1], KELANIS_PORT_COORDINATES[0][0]]
]]);

// Degrees to radians and vice-versa
function toRad(deg: number) { return (deg * Math.PI) / 180; }
function toDeg(rad: number) { return (rad * 180) / Math.PI; }

// Convert degrees to Indonesian Cardinal direction
export function degToCardinal(deg: number): string {
  const cardinals = [
    "Utara (N)", "Timur Laut (NE)", "Timur (E)", "Tenggara (SE)",
    "Selatan (S)", "Barat Daya (SW)", "Barat (W)", "Barat Laut (NW)"
  ];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return cardinals[idx];
}

/**
 * Get nearest wind speed and direction for any coordinate along the Adaro corridor
 */
export function getLocalWindForCoordinate(
  lat: number,
  lng: number,
  fallbackWeather?: CurrentWeather | null
): { speed: number; direction: number; cardinal: string } {
  if (CORRIDOR_WIND_POINTS.length > 0) {
    let nearestPoint = CORRIDOR_WIND_POINTS[0];
    let minDistSq = Infinity;

    for (const pt of CORRIDOR_WIND_POINTS) {
      const distSq = Math.pow(pt.lat - lat, 2) + Math.pow(pt.lng - lng, 2);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearestPoint = pt;
      }
    }

    // Default regional pattern based on location (southeast trade wind prevalent in southern Kalimantan dry season)
    let speed = 12;
    let direction = 130; // From Southeast (SE)

    if (nearestPoint.lng < 115.0) {
      // Kelanis & Barito area: slightly stronger river breeze
      speed = 14;
      direction = 140;
    } else if (nearestPoint.lng > 115.3) {
      // Pit Tutupan / Paringin hill terrain: moderate valley wind
      speed = 11;
      direction = 125;
    }

    if (fallbackWeather && fallbackWeather.windSpeed > 0) {
      speed = fallbackWeather.windSpeed;
      direction = fallbackWeather.windDirection;
    }

    return {
      speed,
      direction,
      cardinal: degToCardinal(direction)
    };
  }

  const speed = fallbackWeather?.windSpeed || 12;
  const direction = fallbackWeather?.windDirection || 135;
  return { speed, direction, cardinal: degToCardinal(direction) };
}

/**
 * Calculate destination point given distance (km) and bearing (deg) from start [lng, lat]
 */
function destinationPoint(
  startLng: number, 
  startLat: number, 
  distanceKm: number, 
  bearingDeg: number
): [number, number] {
  const R = 6371; // Earth radius in km
  const d = distanceKm / R;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(startLat);
  const λ1 = toRad(startLng);

  const sinφ2 = Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(d) * Math.cos(φ1);
  const x = Math.cos(d) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return [toDeg(λ2), toDeg(φ2)]; // [lng, lat]
}

/**
 * Generate a dispersion sector/cone polygon representing smoke plume
 */
function generatePlumeConeRing(
  origin: Coordinates,
  bearingDeg: number,
  spreadAngleDeg: number,
  distanceKm: number,
  steps: number = 8
): [number, number][] {
  const resultCoords: [number, number][] = [];
  const startLng = origin.lng;
  const startLat = origin.lat;

  // Add origin vertex
  resultCoords.push([startLat, startLng]);

  const halfSpread = spreadAngleDeg / 2;
  const startAngle = bearingDeg - halfSpread;
  const angleStep = spreadAngleDeg / steps;

  // Perimeter arc points
  for (let i = 0; i <= steps; i++) {
    const currentAngle = startAngle + i * angleStep;
    const [destLng, destLat] = destinationPoint(startLng, startLat, distanceKm, currentAngle);
    resultCoords.push([destLat, destLng]);
  }

  // Close back to origin
  resultCoords.push([startLat, startLng]);

  return resultCoords;
}

/**
 * Calculate full smoke plume projection and operational impact analysis
 */
export function calculateSmokePlume(
  hotspot: Hotspot,
  weatherOverride?: { speed: number; direction: number }
): SmokePlumeAnalysis {
  const localWind = weatherOverride 
    ? { 
        speed: weatherOverride.speed, 
        direction: weatherOverride.direction, 
        cardinal: degToCardinal(weatherOverride.direction) 
      }
    : getLocalWindForCoordinate(hotspot.location.lat, hotspot.location.lng);

  // In meteorology, wind direction is WHERE wind comes from.
  // Downwind (smoke drift direction) is 180 degrees opposite:
  const downwindDirection = (localWind.direction + 180) % 360;
  const downwindCardinal = degToCardinal(downwindDirection);

  // Smoke plume distances for 1h, 2h, and 3h
  // Minimum distance ensures visibility on map even during calm wind
  const dist1h = Math.max(1.2, (localWind.speed * 1.0));
  const dist2h = Math.max(2.5, (localWind.speed * 2.0));
  const dist3h = Math.max(4.0, (localWind.speed * 3.0));

  // Dispersion angles (cone expands wider as air travels)
  const spread1h = 32; // degrees
  const spread2h = 38;
  const spread3h = 44;

  const ring1 = generatePlumeConeRing(hotspot.location, downwindDirection, spread1h, dist1h);
  const ring2 = generatePlumeConeRing(hotspot.location, downwindDirection, spread2h, dist2h);
  const ring3 = generatePlumeConeRing(hotspot.location, downwindDirection, spread3h, dist3h);

  // Centerline vector for 3 hours
  const centerEnd = destinationPoint(hotspot.location.lng, hotspot.location.lat, dist3h, downwindDirection);
  const centerline: [number, number][] = [
    [hotspot.location.lat, hotspot.location.lng],
    [centerEnd[1], centerEnd[0]]
  ];

  // Convert ring3 into Turf Polygon for spatial intersection analysis
  const turfRing3 = turf.polygon([[
    ...ring3.map(([lat, lng]) => [lng, lat])
  ]]);

  // 1. Check Haul Road impact
  let affectsHaulRoad = false;
  let affectedKmMin = Infinity;
  let affectedKmMax = -Infinity;
  let nearestKm = -1;
  let minDistToHaulRoad = Infinity;

  // Calculate distance from hotspot origin to Haul Road
  const hotspotPt = turf.point([hotspot.location.lng, hotspot.location.lat]);
  const nearestPtOnHaulRoad = turf.nearestPointOnLine(haulRoadLine, hotspotPt);
  minDistToHaulRoad = turf.distance(hotspotPt, nearestPtOnHaulRoad, { units: "kilometers" });

  try {
    // Check if line intersects smoke cone
    const intersectsHaul = turf.lineIntersect(turfRing3, haulRoadLine);
    if (intersectsHaul.features.length > 0 || minDistToHaulRoad < 1.0) {
      affectsHaulRoad = true;
    }

    // Check which milestone points fall within the 3h smoke cone
    for (const ms of ADARO_HAUL_ROAD_MILESTONES) {
      const msPt = turf.point([ms.lng, ms.lat]);
      if (turf.booleanPointInPolygon(msPt, turfRing3)) {
        affectsHaulRoad = true;
        if (ms.km < affectedKmMin) affectedKmMin = ms.km;
        if (ms.km > affectedKmMax) affectedKmMax = ms.km;
      }
    }
  } catch (err) {
    console.warn("Smoke plume haul road intersection check notice:", err);
  }

  // 2. Check Kelanis Port impact
  let affectsKelanisPort = false;
  try {
    if (turf.booleanIntersects(turfRing3, kelanisPolygon)) {
      affectsKelanisPort = true;
    }
  } catch (err) {
    // ignore
  }

  // 3. Check Mine IUPK area impact
  const affectsMineIupk = hotspot.zone === "iupk" || (
    downwindDirection >= 270 || downwindDirection <= 90
  );

  // 4. Affected nearby villages
  const affectedVillages: string[] = [];
  const originVillage = findNearestLocalVillage(hotspot.location.lat, hotspot.location.lng);
  if (originVillage) {
    affectedVillages.push(originVillage);
  }
  const endVillage = findNearestLocalVillage(centerEnd[1], centerEnd[0]);
  if (endVillage && !affectedVillages.includes(endVillage)) {
    affectedVillages.push(endVillage);
  }

  // Build summary & severity
  let severity: "critical" | "warning" | "advisory" | "low" = "low";
  let affectedKmRange: string | undefined = undefined;
  let summaryText = `Asap merambat ke arah ${downwindCardinal} mengikuti tiupan angin (${localWind.speed} km/j).`;
  let driverVisibilityAdvisory = "Jarak pandang jalur transportasi diperkirakan aman.";

  if (affectsHaulRoad) {
    if (affectedKmMin !== Infinity && affectedKmMax !== -Infinity) {
      affectedKmRange = affectedKmMin === affectedKmMax 
        ? `KM ${affectedKmMin}` 
        : `KM ${affectedKmMin} – KM ${affectedKmMax}`;
      summaryText = `⚠️ Lintasan asap mengarah ke Jalur Hauling di sekitar ${affectedKmRange}!`;
    } else {
      summaryText = `⚠️ Lintasan asap diperkirakan melintasi koridor Jalan Hauling!`;
    }
    severity = "critical";
    driverVisibilityAdvisory = "BAHAYA ASAP: Turunkan kecepatan dump truck/trailer, nyalakan lampu hazard & rotary lamp.";
  } else if (affectsKelanisPort) {
    severity = "critical";
    summaryText = `⚠️ Asap bergerak menuju Terminal Pelabuhan Kelanis & Alur Sungai Barito!`;
    driverVisibilityAdvisory = "Waspada pandangan terbatas pada lalu lintas tongkang batubara di alur sungai.";
  } else if (minDistToHaulRoad < 3.0) {
    severity = "warning";
    summaryText = `Asap bergerak sejajar koridor hauling (~${minDistToHaulRoad.toFixed(1)} km).`;
    driverVisibilityAdvisory = "Pantau pergeseran arah angin; waspada rembesan kabut asap saat dini hari.";
  } else {
    severity = "advisory";
    summaryText = `Asap mengarah ke ${downwindCardinal}, menjauhi koridor jalan hauling utama.`;
  }

  return {
    hotspotId: hotspot.id,
    origin: hotspot.location,
    windSpeed: localWind.speed,
    windDirection: localWind.direction,
    windCardinal: localWind.cardinal,
    downwindDirection,
    downwindCardinal,
    coneRings: {
      oneHour: ring1,
      twoHour: ring2,
      threeHour: ring3
    },
    centerline,
    impacts: {
      affectsHaulRoad,
      affectedKmRange,
      nearestHaulRoadKm: nearestKm !== -1 ? nearestKm : undefined,
      distanceToHaulRoadKm: Number(minDistToHaulRoad.toFixed(1)),
      affectsKelanisPort,
      affectsMineIupk,
      affectedVillages,
      severity,
      summaryText,
      driverVisibilityAdvisory
    }
  };
}
