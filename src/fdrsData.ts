import { StationWeatherData } from "./weatherData";

export type FdrsRiskLevel = "Aman" | "Waspada" | "Rawan" | "Sangat Rawan / Ekstrem";

export interface ZoneFdrsSummary {
  zoneId: string;
  zoneName: string;
  locationLabel: string;
  temperature: number; // °C
  relativeHumidity: number; // %
  windSpeed: number; // km/h
  precipitation24h: number; // mm
  daysWithoutRain: number; // estimated days
  ffmcScore: number; // 0 - 100 (Fine Fuel Moisture Code proxy)
  fwiScore: number; // 0 - 100 (Fire Weather Index)
  riskLevel: FdrsRiskLevel;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;
  keyRiskFactor: string;
}

export interface FdrsOverallAssessment {
  currentStatus: FdrsRiskLevel;
  highestRiskScore: number; // 0 - 100
  title: string;
  subtitle: string;
  updatedAt: string;
  zones: ZoneFdrsSummary[];
  safetyAdvisories: {
    title: string;
    description: string;
    level: "mandatory" | "warning" | "advisory";
  }[];
  forecastTrend: {
    day: string;
    date: string;
    status: FdrsRiskLevel;
    tempMax: number;
    rainProb: number;
  }[];
}

/**
 * Calculate Canadian/BMKG FWI approximation from meteorological parameters
 */
export function calculateZoneFdrs(
  zoneId: string,
  zoneName: string,
  locationLabel: string,
  temp: number,
  rh: number,
  windSpeed: number,
  precip24h: number
): ZoneFdrsSummary {
  // 1. FFMC (Fine fuel moisture code approximation)
  // High temp + low humidity + high wind = high FFMC
  let rawScore = 0;

  // Temperature factor (24C base)
  rawScore += Math.max(0, (temp - 24) * 3.8);

  // Dryness / Humidity factor (Relative humidity < 80% increases risk exponentially)
  rawScore += Math.max(0, (82 - rh) * 1.1);

  // Wind factor (Wind > 10 km/h accelerates dry air & fire spreading)
  rawScore += Math.max(0, windSpeed * 0.9);

  // Precipitation damping: rain drastically dampens fuel flammability
  if (precip24h >= 10.0) {
    rawScore = Math.max(12, rawScore * 0.2);
  } else if (precip24h >= 3.0) {
    rawScore = Math.max(20, rawScore * 0.4);
  } else if (precip24h > 0) {
    rawScore = Math.max(25, rawScore * 0.75);
  }

  const fwiScore = Math.min(100, Math.max(10, Math.round(rawScore)));

  // Determine days without rain proxy (if precip == 0, estimate 3-5 days in typical dry spell)
  const daysWithoutRain = precip24h > 0 ? 0 : (fwiScore > 65 ? 5 : 2);

  let riskLevel: FdrsRiskLevel = "Aman";
  let badgeColor = "text-emerald-400";
  let badgeBg = "bg-emerald-500/15";
  let borderColor = "border-emerald-500/40";
  let keyRiskFactor = "Kelembaban tinggi & vegetasi basah";

  if (fwiScore >= 75) {
    riskLevel = "Sangat Rawan / Ekstrem";
    badgeColor = "text-rose-400";
    badgeBg = "bg-rose-500/20";
    borderColor = "border-rose-500/50";
    keyRiskFactor = `Suhu ekstrem (${temp}°C) & kelembaban sangat rendah (${rh}%)`;
  } else if (fwiScore >= 52) {
    riskLevel = "Rawan";
    badgeColor = "text-amber-400";
    badgeBg = "bg-amber-500/20";
    borderColor = "border-amber-500/50";
    keyRiskFactor = `Angin kencang (${windSpeed} km/j) & udara kering`;
  } else if (fwiScore >= 32) {
    riskLevel = "Waspada";
    badgeColor = "text-yellow-400";
    badgeBg = "bg-yellow-500/15";
    borderColor = "border-yellow-500/40";
    keyRiskFactor = "Potensi kekeringan moderat di area terbuka";
  }

  return {
    zoneId,
    zoneName,
    locationLabel,
    temperature: temp,
    relativeHumidity: rh,
    windSpeed,
    precipitation24h: precip24h,
    daysWithoutRain,
    ffmcScore: Math.round(fwiScore * 0.95),
    fwiScore,
    riskLevel,
    badgeColor,
    badgeBg,
    borderColor,
    keyRiskFactor,
  };
}

/**
 * Compile comprehensive FDRS assessment for the entire Adaro operational corridor
 */
export function compileFdrsAssessment(
  stationsData: Record<string, StationWeatherData>
): FdrsOverallAssessment {
  const kelanis = stationsData["kelanis-port"]?.current;
  const km35 = stationsData["hauling-km35"]?.current;
  const tutupan = stationsData["mine-pit-tutupan"]?.current;

  // 1. Mine Pit Area (Tabalong & Balangan)
  const zoneMine = calculateZoneFdrs(
    "mine-area",
    "Area Tambang IUPK Tutupan & Paringin",
    "Kabupaten Tabalong & Balangan (Kalsel)",
    tutupan?.temperature || 33,
    tutupan?.relativeHumidity || 58,
    tutupan?.windSpeed || 11,
    tutupan?.precipitation || 0
  );

  // 2. Hauling Road Corridor (KM 0 - KM 71)
  const zoneHaul = calculateZoneFdrs(
    "haul-road",
    "Koridor Hauling Road (KM 0 – KM 71)",
    "Kab. Barito Timur & Tabalong",
    km35?.temperature || 32,
    km35?.relativeHumidity || 62,
    km35?.windSpeed || 13,
    km35?.precipitation || 0
  );

  // 3. Kelanis Port & Barito River
  const zonePort = calculateZoneFdrs(
    "kelanis-port",
    "Pelabuhan Khusus Batubara Kelanis",
    "Kabupaten Barito Selatan (Kalteng)",
    kelanis?.temperature || 31,
    kelanis?.relativeHumidity || 68,
    kelanis?.windSpeed || 14,
    kelanis?.precipitation || 0
  );

  const zones = [zoneMine, zoneHaul, zonePort];
  const highestRisk = Math.max(...zones.map((z) => z.fwiScore));

  let currentStatus: FdrsRiskLevel = "Aman";
  let title = "STATUS SIAGA: AMAN / RENDAH";
  let subtitle = "Kondisi vegetasi basah, risiko kebakaran lahan rendah.";

  if (highestRisk >= 75) {
    currentStatus = "Sangat Rawan / Ekstrem";
    title = "STATUS SIAGA I: EKSTREM / SANGAT RAWAN";
    subtitle = "Kondisi sangat terik & angin kering. Risiko penyalaan & swabakar batubara sangat tinggi!";
  } else if (highestRisk >= 52) {
    currentStatus = "Rawan";
    title = "STATUS SIAGA II: RAWAN KARHUTLA";
    subtitle = "Vegetasi semak mengering. Waspadai rambatan api di sepanjang buffer dan jalur hauling.";
  } else if (highestRisk >= 32) {
    currentStatus = "Waspada";
    title = "STATUS SIAGA III: WASPADA";
    subtitle = "Kekeringan moderat. Patroli berkala pos sekuriti & ERT direkomendasikan.";
  }

  // Safety advisories based on risk
  const safetyAdvisories: FdrsOverallAssessment["safetyAdvisories"] = [
    {
      title: "Kesiapsiagaan Armada Water Truck",
      description:
        highestRisk >= 52
          ? "Armada Water Truck 20kL & 40kL wajib stand-by penuh dengan tangki terisi air di Pos KM 15, KM 35, KM 65, dan Wara."
          : "Inspeksi kesiapan pompa air dan tangki Water Truck di masing-masing workshop posko.",
      level: highestRisk >= 52 ? "mandatory" : "advisory",
    },
    {
      title: "Pengawasan Swabakar Batubara (Spontaneous Combustion)",
      description:
        highestRisk >= 52
          ? "Pemeriksaan suhu timbunan batubara di ROM & Stockpile Kelanis minimal 2 kali sehari menggunakan thermo-gun."
          : "Pemadatan rutin stockpile batubara untuk meminimalkan paparan oksigen pada batubara berbutir halus.",
      level: highestRisk >= 52 ? "warning" : "advisory",
    },
    {
      title: "Larangan Hot-Work & Izin Kerja Panas",
      description:
        highestRisk >= 75
          ? "Pekerjaan pengelasan atau pemotongan logam terbuka di radius < 50 meter dari semak/rumput kering DILARANG kecuali mendapat persetujuan Safety KTT & didampingi fire watch."
          : "Sediakan APAR dan terpal tahan api (fire blanket) saat melakukan pekerjaan perbaikan di sepanjang jalur hauling.",
      level: highestRisk >= 75 ? "mandatory" : "advisory",
    },
    {
      title: "Patroli Darat Mandiri di Jalur Hauling",
      description:
        highestRisk >= 52
          ? "Jadwalkan patroli bermotor security setiap 2 jam sekali pada titik-titik rawan ilalang kering (KM 18–25 & KM 48–56)."
          : "Patroli rutin pada pergantian shift pagi dan sore oleh petugas pos security terdekat.",
      level: highestRisk >= 52 ? "warning" : "advisory",
    },
  ];

  // Forecast trend from station daily forecast
  const dailyTutupan = stationsData["mine-pit-tutupan"]?.daily || [];
  const forecastTrend = dailyTutupan.slice(0, 3).map((d) => ({
    day: d.dayName,
    date: d.date,
    status: (d.fireRisk === "Sangat Mudah Terbakar"
      ? "Sangat Rawan / Ekstrem"
      : d.fireRisk === "Rawan"
      ? "Rawan"
      : d.fireRisk === "Waspada"
      ? "Waspada"
      : "Aman") as FdrsRiskLevel,
    tempMax: d.tempMax,
    rainProb: d.precipitationProbabilityMax,
  }));

  return {
    currentStatus,
    highestRiskScore: highestRisk,
    title,
    subtitle,
    updatedAt: new Date().toLocaleTimeString("id-ID", {
      timeZone: "Asia/Makassar",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WITA",
    zones,
    safetyAdvisories,
    forecastTrend,
  };
}
