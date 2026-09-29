// Database Koordinat Desa / Kelurahan di Sekitar Wilayah Operasional IUPK & Koridor Hauling
// Mencakup Kabupaten Tabalong, Kabupaten Balangan, Kabupaten Barito Timur, dan Kabupaten Barito Selatan

export interface LocalVillage {
  name: string;
  kecamatan: string;
  kabupaten: string;
  lat: number;
  lng: number;
}

export const ADARO_CORRIDOR_VILLAGES: LocalVillage[] = [
  // --- KABUPATEN BALANGAN (Area Tambang Paringin, Wara, Dahai, dll.) ---
  { name: "Dahai", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.2642, lng: 115.4665 },
  { name: "Lasung Batu", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.2750, lng: 115.4850 },
  { name: "Paringin Kota", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.3385, lng: 115.4645 },
  { name: "Paringin Timur", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.3320, lng: 115.4780 },
  { name: "Balida", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.3380, lng: 115.4670 },
  { name: "Kalahiang", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.3420, lng: 115.4320 },
  { name: "Murung Ilung", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.3225, lng: 115.4919 },
  { name: "Lamida Bawah", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.2980, lng: 115.5100 },
  { name: "Lamida Atas", kecamatan: "Paringin", kabupaten: "Balangan", lat: -2.2850, lng: 115.5180 },
  { name: "Hukai", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.3201, lng: 115.5448 },
  { name: "Marias", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.3020, lng: 115.5250 },
  { name: "Sirap", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2900, lng: 115.5600 },
  { name: "Buntu Karau", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2810, lng: 115.5420 },
  { name: "Mungkur Uyam", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2680, lng: 115.5580 },
  { name: "Sumber Rejeki", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2200, lng: 115.5800 },
  { name: "Wonorejo", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2135, lng: 115.5939 },
  { name: "Bata", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2450, lng: 115.5820 },
  { name: "Galumbang", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2650, lng: 115.5950 },
  { name: "Panim", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2950, lng: 115.6020 },
  { name: "Tigarun", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.3150, lng: 115.6050 },
  { name: "Juai", kecamatan: "Juai", kabupaten: "Balangan", lat: -2.2710, lng: 115.6250 },
  { name: "Telaga Purun", kecamatan: "Paringin Selatan", kabupaten: "Balangan", lat: -2.3550, lng: 115.4850 },
  { name: "Inan", kecamatan: "Paringin Selatan", kabupaten: "Balangan", lat: -2.3680, lng: 115.4950 },
  { name: "Batu Mandi", kecamatan: "Batu Mandi", kabupaten: "Balangan", lat: -2.4050, lng: 115.4350 },
  { name: "Halong", kecamatan: "Halong", kabupaten: "Balangan", lat: -2.3850, lng: 115.6550 },
  { name: "Awayan", kecamatan: "Awayan", kabupaten: "Balangan", lat: -2.4200, lng: 115.5550 },
  { name: "Tebing Tinggi", kecamatan: "Tebing Tinggi", kabupaten: "Balangan", lat: -2.4850, lng: 115.6150 },

  // --- KABUPATEN TABALONG (Area Tambang Tutupan, Wara Utara, Kantor Tabalong) ---
  { name: "Maburai", kecamatan: "Murung Pudak", kabupaten: "Tabalong", lat: -2.2350, lng: 115.4350 },
  { name: "Warukin", kecamatan: "Tanta", kabupaten: "Tabalong", lat: -2.2150, lng: 115.4250 },
  { name: "Padang Panjang", kecamatan: "Tanta", kabupaten: "Tabalong", lat: -2.2280, lng: 115.4410 },
  { name: "Tanta", kecamatan: "Tanta", kabupaten: "Tabalong", lat: -2.2020, lng: 115.4120 },
  { name: "Murung Karangan", kecamatan: "Tanta", kabupaten: "Tabalong", lat: -2.2180, lng: 115.3950 },
  { name: "Barimbun", kecamatan: "Tanta", kabupaten: "Tabalong", lat: -2.2350, lng: 115.3850 },
  { name: "Tamiyang", kecamatan: "Tanta", kabupaten: "Tabalong", lat: -2.2510, lng: 115.4150 },
  { name: "Kasiau", kecamatan: "Murung Pudak", kabupaten: "Tabalong", lat: -2.1850, lng: 115.4350 },
  { name: "Mabu'un", kecamatan: "Murung Pudak", kabupaten: "Tabalong", lat: -2.1880, lng: 115.4050 },
  { name: "Tanjung", kecamatan: "Tanjung", kabupaten: "Tabalong", lat: -2.1825, lng: 115.3800 },
  { name: "Jangkung", kecamatan: "Tanjung", kabupaten: "Tabalong", lat: -2.1650, lng: 115.3820 },
  { name: "Mahe Seberang", kecamatan: "Tanjung", kabupaten: "Tabalong", lat: -2.1520, lng: 115.3650 },
  { name: "Wayau", kecamatan: "Tanjung", kabupaten: "Tabalong", lat: -2.1280, lng: 115.3850 },
  { name: "Garunggung", kecamatan: "Tanjung", kabupaten: "Tabalong", lat: -2.1150, lng: 115.3950 },
  { name: "Haruai", kecamatan: "Haruai", kabupaten: "Tabalong", lat: -2.0520, lng: 115.4450 },
  { name: "Nawin", kecamatan: "Haruai", kabupaten: "Tabalong", lat: -2.0950, lng: 115.4650 },
  { name: "Bongkang", kecamatan: "Haruai", kabupaten: "Tabalong", lat: -2.0810, lng: 115.4850 },
  { name: "Marindi", kecamatan: "Haruai", kabupaten: "Tabalong", lat: -2.0720, lng: 115.4950 },
  { name: "Wirang", kecamatan: "Haruai", kabupaten: "Tabalong", lat: -2.1020, lng: 115.4380 },
  { name: "Hayup", kecamatan: "Haruai", kabupaten: "Tabalong", lat: -2.0350, lng: 115.4680 },
  { name: "Upau", kecamatan: "Upau", kabupaten: "Tabalong", lat: -2.0450, lng: 115.5450 },
  { name: "Kinarum", kecamatan: "Upau", kabupaten: "Tabalong", lat: -2.0150, lng: 115.5650 },
  { name: "Kaong", kecamatan: "Upau", kabupaten: "Tabalong", lat: -2.0280, lng: 115.5250 },
  { name: "Muara Uya", kecamatan: "Muara Uya", kabupaten: "Tabalong", lat: -1.9850, lng: 115.5350 },
  { name: "Ribang", kecamatan: "Muara Uya", kabupaten: "Tabalong", lat: -1.9520, lng: 115.5550 },
  { name: "Jaro", kecamatan: "Jaro", kabupaten: "Tabalong", lat: -1.8650, lng: 115.5650 },
  { name: "Bintang Ara", kecamatan: "Bintang Ara", kabupaten: "Tabalong", lat: -2.0950, lng: 115.2850 },
  { name: "Kelua", kecamatan: "Kelua", kabupaten: "Tabalong", lat: -2.2680, lng: 115.2950 },
  { name: "Pudak Benawa", kecamatan: "Kelua", kabupaten: "Tabalong", lat: -2.2550, lng: 115.2850 },
  { name: "Banua Lawas", kecamatan: "Banua Lawas", kabupaten: "Tabalong", lat: -2.3150, lng: 115.2450 },

  // --- KABUPATEN BARITO TIMUR (Jalur Hauling Road KM 20 - KM 60) ---
  { name: "Patas", kecamatan: "Gunung Bintang Awai", kabupaten: "Barito Selatan", lat: -2.0250, lng: 115.0850 },
  { name: "Bentot", kecamatan: "Patangkep Tutui", kabupaten: "Barito Timur", lat: -2.0850, lng: 115.2150 },
  { name: "Kalamus", kecamatan: "Paket", kabupaten: "Barito Timur", lat: -2.1250, lng: 115.2050 },
  { name: "Tampa", kecamatan: "Paku", kabupaten: "Barito Timur", lat: -2.1550, lng: 115.1850 },
  { name: "Tarinsing", kecamatan: "Paku", kabupaten: "Barito Timur", lat: -2.1750, lng: 115.1650 },
  { name: "Raren Batuah", kecamatan: "Dusun Tengah", kabupaten: "Barito Timur", lat: -2.1280, lng: 115.1450 },
  { name: "Ampah Kota", kecamatan: "Dusun Tengah", kabupaten: "Barito Timur", lat: -2.1150, lng: 115.1250 },
  { name: "Dayu", kecamatan: "Karusen Janang", kabupaten: "Barito Timur", lat: -2.1950, lng: 115.1650 },
  { name: "Ipu Mea", kecamatan: "Karusen Janang", kabupaten: "Barito Timur", lat: -2.2150, lng: 115.1550 },
  { name: "Simpang Bingkuang", kecamatan: "Paket", kabupaten: "Barito Timur", lat: -2.2450, lng: 115.1250 },
  { name: "Dorong", kecamatan: "Dusun Timur", kabupaten: "Barito Timur", lat: -2.2650, lng: 115.1450 },
  { name: "Jaar", kecamatan: "Dusun Timur", kabupaten: "Barito Timur", lat: -2.2780, lng: 115.1550 },
  { name: "Tamiang Layang", kecamatan: "Dusun Timur", kabupaten: "Barito Timur", lat: -2.2850, lng: 115.1750 },
  { name: "Jaweten", kecamatan: "Dusun Timur", kabupaten: "Barito Timur", lat: -2.3150, lng: 115.1650 },
  { name: "Karang Langit", kecamatan: "Dusun Timur", kabupaten: "Barito Timur", lat: -2.3050, lng: 115.1350 },
  { name: "Murutuwu", kecamatan: "Paju Epat", kabupaten: "Barito Timur", lat: -2.2750, lng: 115.0250 },
  { name: "Telang Baru", kecamatan: "Paju Epat", kabupaten: "Barito Timur", lat: -2.2850, lng: 114.9850 },
  { name: "Telang", kecamatan: "Paju Epat", kabupaten: "Barito Timur", lat: -2.2650, lng: 114.9650 },
  { name: "Maipe", kecamatan: "Paju Epat", kabupaten: "Barito Timur", lat: -2.2550, lng: 114.9450 },
  { name: "Siong", kecamatan: "Paju Epat", kabupaten: "Barito Timur", lat: -2.2450, lng: 114.9350 },
  { name: "Balawa", kecamatan: "Paju Epat", kabupaten: "Barito Timur", lat: -2.2350, lng: 114.9150 },
  { name: "Taniran", kecamatan: "Benua Lima", kabupaten: "Barito Timur", lat: -2.3350, lng: 115.1250 },
  { name: "Pasar Panas", kecamatan: "Benua Lima", kabupaten: "Barito Timur", lat: -2.3550, lng: 115.1450 },

  // --- KABUPATEN BARITO SELATAN (Area Kelanis Port & KM 0 - KM 20) ---
  { name: "Kelanis (Pelabuhan Port)", kecamatan: "Dusun Hilir", kabupaten: "Barito Selatan", lat: -2.2935, lng: 114.8725 },
  { name: "Teluk Timbau", kecamatan: "Dusun Hilir", kabupaten: "Barito Selatan", lat: -2.2450, lng: 114.8450 },
  { name: "Batampang", kecamatan: "Dusun Hilir", kabupaten: "Barito Selatan", lat: -2.2250, lng: 114.8550 },
  { name: "Mangkarap", kecamatan: "Dusun Selatan", kabupaten: "Barito Selatan", lat: -2.2550, lng: 114.9050 },
  { name: "Mangkatip", kecamatan: "Dusun Hilir", kabupaten: "Barito Selatan", lat: -2.2150, lng: 114.8350 },
  { name: "Buntok", kecamatan: "Dusun Selatan", kabupaten: "Barito Selatan", lat: -1.7250, lng: 114.8450 },
  { name: "Jenamas", kecamatan: "Jenamas", kabupaten: "Barito Selatan", lat: -2.3850, lng: 114.9250 }
];

/**
 * Mencari desa terdekat secara instan (<0.01ms) berdasarkan koordinat
 * Menggunakan perhitungan Haversine Distance
 */
export function findNearestLocalVillage(lat: number, lng: number, maxDistanceKm = 6.5): string | null {
  let nearestVillage: LocalVillage | null = null;
  let minDistance = Infinity;

  // Optimasi cepat: bounding box delta lat/lng
  const degThreshold = maxDistanceKm / 111; // ~0.058 derajat

  for (let i = 0; i < ADARO_CORRIDOR_VILLAGES.length; i++) {
    const v = ADARO_CORRIDOR_VILLAGES[i];
    const dLat = Math.abs(lat - v.lat);
    const dLng = Math.abs(lng - v.lng);

    if (dLat > degThreshold || dLng > degThreshold) continue;

    // Haversine approximation
    const dLatRad = (lat - v.lat) * (Math.PI / 180);
    const dLngRad = (lng - v.lng) * (Math.PI / 180);
    const a = 
      Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
      Math.cos(lat * (Math.PI / 180)) * Math.cos(v.lat * (Math.PI / 180)) * 
      Math.sin(dLngRad / 2) * Math.sin(dLngRad / 2);
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (dist < minDistance) {
      minDistance = dist;
      nearestVillage = v;
    }
  }

  if (nearestVillage && minDistance <= maxDistanceKm) {
    return `Desa ${nearestVillage.name}, Kec. ${nearestVillage.kecamatan}, Kab. ${nearestVillage.kabupaten}`;
  }

  return null;
}
