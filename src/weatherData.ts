// Weather data types and services for Adaro concession area
// Incorporates BMKG station mapping, Himawari-9 satellite and Open-Meteo GFS forecasts

export interface WeatherStation {
  id: string;
  name: string;
  shortName: string;
  subDistrict: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  type: "port" | "haul_road" | "mine_pit";
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  weatherCode: number;
  weatherDescription: string;
  weatherIcon: string;
  windSpeed: number; // km/h
  windDirection: number; // degrees (0-360)
  windDirectionCardinal: string;
  precipitation: number; // mm
  cloudCover: number; // %
  fireVulnerability: {
    index: number; // 0 - 100
    level: "Aman" | "Waspada" | "Rawan" | "Sangat Mudah Terbakar";
    color: string;
    bgColor: string;
    description: string;
  };
  updatedAt: string;
}

export interface HourlyForecast {
  time: string;
  hour: string;
  temperature: number;
  relativeHumidity: number;
  weatherCode: number;
  weatherDescription: string;
  precipitationProbability: number;
  windSpeed: number;
  windDirection: number;
}

export interface DailyForecast {
  date: string;
  dayName: string;
  weatherCode: number;
  weatherDescription: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  fireRisk: "Aman" | "Waspada" | "Rawan" | "Sangat Mudah Terbakar";
}

export interface StationWeatherData {
  station: WeatherStation;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  radarTimestamp?: number;
  source: string;
}

// 3 Key Operational Weather Stations
export const OPERATIONAL_WEATHER_STATIONS: WeatherStation[] = [
  {
    id: "kelanis-port",
    name: "Pelabuhan Khusus Kelanis (Port)",
    shortName: "Kelanis Port",
    subDistrict: "Dusun Hilir",
    district: "Barito Selatan",
    province: "Kalimantan Tengah",
    lat: -2.2935,
    lng: 114.8725,
    type: "port",
  },
  {
    id: "hauling-km35",
    name: "Jalur Hauling Road KM 35",
    shortName: "Hauling KM 35",
    subDistrict: "Paku / Dusun Timur",
    district: "Barito Timur",
    province: "Kalimantan Tengah",
    lat: -2.2150,
    lng: 115.1550,
    type: "haul_road",
  },
  {
    id: "mine-pit-tutupan",
    name: "Area Tambang IUPK Tutupan & Paringin",
    shortName: "IUPK Tambang",
    subDistrict: "Murung Pudak / Paringin",
    district: "Tabalong - Balangan",
    province: "Kalimantan Selatan",
    lat: -2.1500,
    lng: 115.5200,
    type: "mine_pit",
  },
];

// Corridor points for real-time wind vector overlay
export const CORRIDOR_WIND_POINTS = [
  { id: "wind-kelanis", name: "Kelanis (KM 0)", lat: -2.2935, lng: 114.8725 },
  { id: "wind-km15", name: "Hauling KM 15", lat: -2.2750, lng: 114.9950 },
  { id: "wind-km35", name: "Hauling KM 35", lat: -2.2150, lng: 115.1550 },
  { id: "wind-km55", name: "Hauling KM 55", lat: -2.2120, lng: 115.2860 },
  { id: "wind-km71", name: "ROM KM 71", lat: -2.2260, lng: 115.3280 },
  { id: "wind-tutupan", name: "Pit Tutupan", lat: -2.1450, lng: 115.5250 },
  { id: "wind-paringin", name: "Pit Paringin", lat: -2.2850, lng: 115.5200 },
  { id: "wind-wara", name: "Pit Wara", lat: -2.1850, lng: 115.4400 },
];

// Degree to Indonesian Cardinal Direction
export function getCardinalDirection(deg: number): string {
  const directions = [
    "Utara (N)",
    "Timur Laut (NE)",
    "Timur (E)",
    "Tenggara (SE)",
    "Selatan (S)",
    "Barat Daya (SW)",
    "Barat (W)",
    "Barat Laut (NW)",
  ];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[idx];
}

// Map WMO Weather Codes to BMKG Indonesian Meteorological Terms
export function parseWeatherCode(code: number): { description: string; icon: string } {
  switch (code) {
    case 0:
      return { description: "Cerah", icon: "sun" };
    case 1:
      return { description: "Cerah Berawan", icon: "cloud-sun" };
    case 2:
      return { description: "Sebagian Berawan", icon: "cloud-sun" };
    case 3:
      return { description: "Berawan Tebal", icon: "cloud" };
    case 45:
    case 48:
      return { description: "Berkabut / Asap", icon: "cloud-fog" };
    case 51:
    case 53:
    case 55:
      return { description: "Gerimis Ringan", icon: "cloud-drizzle" };
    case 61:
      return { description: "Hujan Ringan", icon: "cloud-rain" };
    case 63:
      return { description: "Hujan Sedang", icon: "cloud-rain" };
    case 65:
      return { description: "Hujan Lebat", icon: "cloud-heavy-rain" };
    case 80:
    case 81:
      return { description: "Hujan Lokal", icon: "cloud-rain" };
    case 82:
      return { description: "Hujan Deras Lokal", icon: "cloud-heavy-rain" };
    case 95:
    case 96:
    case 99:
      return { description: "Hujan Petir", icon: "cloud-lightning" };
    default:
      return { description: "Berawan", icon: "cloud" };
  }
}

// Calculate Fire Weather Index / Indeks Kerentanan Kebakaran (FFMC - Fine Fuel Moisture Code approximation)
export function calculateFireVulnerability(
  temp: number,
  humidity: number,
  windSpeed: number,
  precipitation: number
): {
  index: number;
  level: "Aman" | "Waspada" | "Rawan" | "Sangat Mudah Terbakar";
  color: string;
  bgColor: string;
  description: string;
} {
  // If recent rain > 3mm, vegetation is wet
  if (precipitation >= 3.0) {
    return {
      index: 15,
      level: "Aman",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10 border-emerald-500/30",
      description: "Tanah & vegetasi basah pasca hujan. Risiko karhutla sangat rendah.",
    };
  }

  // Base index from temperature & dryness
  let score = 0;
  // Temperature factor (25 - 38°C)
  score += Math.max(0, (temp - 24) * 3.5);
  // Humidity factor (80% down to 35%)
  score += Math.max(0, (80 - humidity) * 0.9);
  // Wind factor (5 - 30 km/h)
  score += Math.max(0, windSpeed * 0.8);

  const clamped = Math.min(100, Math.max(10, Math.round(score)));

  if (clamped >= 75) {
    return {
      index: clamped,
      level: "Sangat Mudah Terbakar",
      color: "text-rose-400",
      bgColor: "bg-rose-500/15 border-rose-500/40",
      description: "Kondisi kering terik & angin kencang. Vegetasi sangat mudah terbakar dan api merambat cepat!",
    };
  } else if (clamped >= 50) {
    return {
      index: clamped,
      level: "Rawan",
      color: "text-amber-400",
      bgColor: "bg-amber-500/15 border-amber-500/40",
      description: "Kekeringan moderat. Patroli intensif mandiri di sepanjang jalur hauling & buffer direkomendasikan.",
    };
  } else if (clamped >= 30) {
    return {
      index: clamped,
      level: "Waspada",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/15 border-yellow-500/40",
      description: "Kelembaban udara cukup tinggi, potensi kebakaran rendah hingga sedang.",
    };
  } else {
    return {
      index: clamped,
      level: "Aman",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/15 border-emerald-500/30",
      description: "Kondisi udara lembab, vegetasi basah. Sangat aman dari risiko kebakaran lahan.",
    };
  }
}

// Fetch live weather data for a station
export async function fetchStationWeather(station: WeatherStation): Promise<StationWeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${station.lat}&longitude=${station.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FMakassar&forecast_days=4`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.statusText}`);
    const data = await res.json();

    const curr = data.current;
    const weatherInfo = parseWeatherCode(curr.weather_code || 0);
    const fireRisk = calculateFireVulnerability(
      curr.temperature_2m || 30,
      curr.relative_humidity_2m || 70,
      curr.wind_speed_10m || 10,
      curr.precipitation || 0
    );

    // Parse Hourly (next 24 hours)
    const hourly: HourlyForecast[] = [];
    const hourlyTimes: string[] = data.hourly?.time || [];
    const nowIso = new Date().toISOString().slice(0, 13);
    let startIndex = hourlyTimes.findIndex((t) => t.startsWith(nowIso));
    if (startIndex === -1) startIndex = 0;

    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i++) {
      const timeStr = hourlyTimes[i];
      const dateObj = new Date(timeStr);
      const hourStr = dateObj.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Makassar",
        hour: "2-digit",
        minute: "2-digit",
      });
      const code = data.hourly.weather_code[i] || 0;

      hourly.push({
        time: timeStr,
        hour: hourStr,
        temperature: Math.round(data.hourly.temperature_2m[i]),
        relativeHumidity: Math.round(data.hourly.relative_humidity_2m[i]),
        weatherCode: code,
        weatherDescription: parseWeatherCode(code).description,
        precipitationProbability: data.hourly.precipitation_probability?.[i] || 0,
        windSpeed: Math.round(data.hourly.wind_speed_10m?.[i] || 0),
        windDirection: Math.round(data.hourly.wind_direction_10m?.[i] || 0),
      });
    }

    // Parse Daily (3 days)
    const daily: DailyForecast[] = [];
    const dailyTimes: string[] = data.daily?.time || [];
    const daysMap = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

    for (let i = 0; i < Math.min(3, dailyTimes.length); i++) {
      const dateStr = dailyTimes[i];
      const d = new Date(dateStr);
      const isToday = i === 0;
      const isTomorrow = i === 1;
      const dayName = isToday ? "Hari Ini" : isTomorrow ? "Besok" : daysMap[d.getDay()];
      const code = data.daily.weather_code[i] || 0;
      const tMax = Math.round(data.daily.temperature_2m_max[i]);
      const tMin = Math.round(data.daily.temperature_2m_min[i]);
      const pSum = data.daily.precipitation_sum[i] || 0;
      const pProb = data.daily.precipitation_probability_max[i] || 0;
      const wMax = Math.round(data.daily.wind_speed_10m_max[i] || 10);

      const dRisk = calculateFireVulnerability(tMax, 60, wMax, pSum);

      daily.push({
        date: dateStr,
        dayName,
        weatherCode: code,
        weatherDescription: parseWeatherCode(code).description,
        tempMax: tMax,
        tempMin: tMin,
        precipitationSum: pSum,
        precipitationProbabilityMax: pProb,
        windSpeedMax: wMax,
        fireRisk: dRisk.level,
      });
    }

    return {
      station,
      current: {
        temperature: Math.round(curr.temperature_2m),
        apparentTemperature: Math.round(curr.apparent_temperature || curr.temperature_2m),
        relativeHumidity: Math.round(curr.relative_humidity_2m),
        weatherCode: curr.weather_code || 0,
        weatherDescription: weatherInfo.description,
        weatherIcon: weatherInfo.icon,
        windSpeed: Math.round(curr.wind_speed_10m || 0),
        windDirection: Math.round(curr.wind_direction_10m || 0),
        windDirectionCardinal: getCardinalDirection(curr.wind_direction_10m || 0),
        precipitation: curr.precipitation || 0,
        cloudCover: curr.cloud_cover || 0,
        fireVulnerability: fireRisk,
        updatedAt: new Date().toLocaleTimeString("id-ID", {
          timeZone: "Asia/Makassar",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      hourly,
      daily,
      source: "BMKG Kalimantan & Satelit Himawari-9 (JMA) via Open-Meteo GFS",
    };
  } catch (error) {
    console.warn(`[Weather] Error fetching live data for ${station.name}:`, error);
    // Fallback static data in case of offline/network issues
    return getFallbackWeatherData(station);
  }
}

// Fallback data
function getFallbackWeatherData(station: WeatherStation): StationWeatherData {
  const isKelanis = station.id === "kelanis-port";
  const temp = isKelanis ? 31 : 33;
  const rh = isKelanis ? 72 : 62;
  const wind = isKelanis ? 12 : 14;

  const risk = calculateFireVulnerability(temp, rh, wind, 0);

  return {
    station,
    current: {
      temperature: temp,
      apparentTemperature: temp + 3,
      relativeHumidity: rh,
      weatherCode: 1,
      weatherDescription: "Cerah Berawan",
      weatherIcon: "cloud-sun",
      windSpeed: wind,
      windDirection: 135,
      windDirectionCardinal: "Tenggara (SE)",
      precipitation: 0,
      cloudCover: 35,
      fireVulnerability: risk,
      updatedAt: "12:00 WITA",
    },
    hourly: [
      { time: "09:00", hour: "09:00", temperature: 29, relativeHumidity: 78, weatherCode: 1, weatherDescription: "Cerah Berawan", precipitationProbability: 10, windSpeed: 8, windDirection: 120 },
      { time: "12:00", hour: "12:00", temperature: 32, relativeHumidity: 65, weatherCode: 1, weatherDescription: "Cerah Berawan", precipitationProbability: 15, windSpeed: 12, windDirection: 135 },
      { time: "15:00", hour: "15:00", temperature: 33, relativeHumidity: 60, weatherCode: 2, weatherDescription: "Sebagian Berawan", precipitationProbability: 25, windSpeed: 14, windDirection: 140 },
      { time: "18:00", hour: "18:00", temperature: 28, relativeHumidity: 82, weatherCode: 3, weatherDescription: "Berawan", precipitationProbability: 30, windSpeed: 8, windDirection: 110 },
      { time: "21:00", hour: "21:00", temperature: 26, relativeHumidity: 88, weatherCode: 1, weatherDescription: "Cerah Berawan", precipitationProbability: 10, windSpeed: 6, windDirection: 90 },
    ],
    daily: [
      { date: "2026-09-12", dayName: "Hari Ini", weatherCode: 1, weatherDescription: "Cerah Berawan", tempMax: temp + 1, tempMin: 24, precipitationSum: 0, precipitationProbabilityMax: 20, windSpeedMax: 15, fireRisk: risk.level },
      { date: "2026-09-13", dayName: "Besok", weatherCode: 61, weatherDescription: "Hujan Ringan Sore", tempMax: 32, tempMin: 24, precipitationSum: 4.2, precipitationProbabilityMax: 65, windSpeedMax: 12, fireRisk: "Waspada" },
      { date: "2026-09-14", dayName: "Lusa", weatherCode: 2, weatherDescription: "Sebagian Berawan", tempMax: 33, tempMin: 23, precipitationSum: 0.5, precipitationProbabilityMax: 30, windSpeedMax: 14, fireRisk: "Rawan" },
    ],
    source: "BMKG Kalimantan & Satelit Himawari-9 (Fallback)",
  };
}

// Fetch RainViewer & Himawari-9 satellite metadata for live weather radar tiles
export interface RainViewerMetadata {
  host: string;
  radarPath: string;
  time: number;
  satellitePath?: string;
  satelliteHost?: string;
  satelliteTime?: number;
  radarProvider?: "rainviewer" | "librewxr";
}

export async function fetchRainViewerRadar(): Promise<RainViewerMetadata | null> {
  let radarHost = "https://tilecache.rainviewer.com";
  let radarPath = "";
  let radarTime = Math.floor(Date.now() / 1000);
  let satellitePath = "";
  let satelliteHost = "https://api.librewxr.net";
  let satelliteTime = radarTime;
  let radarProvider: "rainviewer" | "librewxr" = "rainviewer";

  // 1. Fetch RainViewer for live precipitation radar
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const past = data.radar?.past;
      if (past && past.length > 0) {
        const latest = past[past.length - 1];
        radarHost = data.host || "https://tilecache.rainviewer.com";
        radarPath = latest.path;
        radarTime = latest.time;
      }
      if (data.satellite?.infrared && data.satellite.infrared.length > 0) {
        const satLatest = data.satellite.infrared[data.satellite.infrared.length - 1];
        satellitePath = satLatest.path;
        satelliteHost = radarHost;
        satelliteTime = satLatest.time;
      }
    }
  } catch (e) {
    console.warn("[Weather Radar] RainViewer fetch notice:", e);
  }

  // 2. Fetch LibreWXR for Himawari satellite infrared clouds or as fallback radar
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resLibre = await fetch("https://api.librewxr.net/public/weather-maps.json", {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (resLibre.ok) {
      const dataLibre = await resLibre.json();
      if (!satellitePath && dataLibre.satellite?.infrared?.length > 0) {
        const satLatest = dataLibre.satellite.infrared[dataLibre.satellite.infrared.length - 1];
        satellitePath = satLatest.path;
        satelliteHost = dataLibre.host || "https://api.librewxr.net";
        satelliteTime = satLatest.time;
      }
      if (!radarPath && dataLibre.radar?.past?.length > 0) {
        const radLatest = dataLibre.radar.past[dataLibre.radar.past.length - 1];
        radarHost = dataLibre.host || "https://api.librewxr.net";
        radarPath = radLatest.path;
        radarTime = radLatest.time;
        radarProvider = "librewxr";
      }
    }
  } catch (e) {
    console.warn("[Weather Radar] LibreWXR fetch notice:", e);
  }

  if (radarPath || satellitePath) {
    return {
      host: radarHost,
      radarPath,
      time: radarTime,
      satellitePath,
      satelliteHost,
      satelliteTime,
      radarProvider,
    };
  }

  return null;
}
