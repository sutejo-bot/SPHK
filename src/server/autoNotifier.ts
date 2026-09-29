import fs from "fs";
import path from "path";
import { checkHotspotZone } from "../data";
import { findNearestLocalVillage } from "../villageData";

export interface AutoNotifierStatus {
  enabled: boolean;
  intervalMinutes: number;
  clusterWindowHours?: number;
  lastRunTime: string | null;
  lastCheckStatus: string;
  newHotspotsDetectedLastRun: number;
  totalTrackedHotspots: number;
  telegramConfigured: boolean;
  whatsappConfigured: boolean;
  whatsappTarget?: string;
  whatsappTargetSource?: string;
  telegramHeartbeatTarget?: any;
  telegramChatIdMasked?: string;
  consecutiveNasaFailures?: number;
  nasaOutageAlertSent?: boolean;
  heartbeatDaemonActive?: boolean;
  recentNotifications: Array<{
    id: string;
    lat: number;
    lng: number;
    detectedAt: string;
    notifiedAt: string;
    location: string;
    zone: string;
    status: string;
    source?: string;
    telegramSent?: boolean;
    telegramError?: string;
    waSent?: boolean;
    waError?: string;
    processDurationSeconds?: number;
    clusterWith?: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORAGE_FILE = path.join(DATA_DIR, "notified_hotspots.json");
const BACKUP_FILE = path.join(DATA_DIR, "notified_hotspots.json.bak");
const TEMP_FILE = path.join(DATA_DIR, "notified_hotspots.json.tmp");
const SETTINGS_FILE = path.join(DATA_DIR, "notifier_settings.json");

export interface NotifierSettings {
  whatsappTarget?: string;
  telegramHeartbeatUser?: string;
  autoNotifyIntervalMinutes?: number;
  heartbeatIntervalMinutes?: number;
  adminPassword?: string;
}

export function getNotifierSettings(): NotifierSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function getEffectiveAdminPassword(): string {
  const settings = getNotifierSettings();
  if (settings.adminPassword && settings.adminPassword.trim()) {
    return settings.adminPassword.trim();
  }
  return (process.env.ADMIN_PASSWORD || process.env.WA_ADMIN_PASSWORD || "admin123").trim();
}

export function saveNotifierSettings(settings: Partial<NotifierSettings>): NotifierSettings {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = getNotifierSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch (e) {
    console.error("[Settings] Gagal menyimpan settings:", e);
    return getNotifierSettings();
  }
}

// =========================================================================
// SENSITIVE CREDENTIAL & TARGET MASKING HELPERS (PRIVACY PROTECTION)
// =========================================================================

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  const clean = phone.trim();
  if (clean.includes("@g.us")) {
    if (clean.length > 10) {
      return `${clean.slice(0, 5)}****${clean.slice(-9)}`;
    }
    return clean;
  }
  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 10) {
    const prefix = clean.slice(0, 4);
    const suffix = clean.slice(-4);
    return `${prefix}****${suffix}`;
  }
  if (clean.length >= 7) {
    return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
  }
  return clean;
}

export function maskTelegramId(chatId?: string | number | null): string {
  if (!chatId) return "";
  const str = String(chatId).trim();
  if (str.startsWith("-")) {
    if (str.length > 7) {
      return `${str.slice(0, 4)}****${str.slice(-4)}`;
    }
    return str;
  }
  if (str.length >= 7) {
    return `${str.slice(0, 3)}****${str.slice(-3)}`;
  }
  if (str.length >= 4) {
    return `${str.slice(0, 2)}****${str.slice(-2)}`;
  }
  return str;
}

export function maskBotUsername(botUsername?: string | null): string {
  if (!botUsername) return "bot";
  const clean = botUsername.trim().replace(/^@/, "");
  if (clean.toLowerCase().endsWith("_bot") && clean.length > 6) {
    return `${clean.slice(0, 2)}***_bot`;
  }
  if (clean.length > 5) {
    return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
  }
  return clean;
}

// Resolusi nomor target WhatsApp otomatis:
// 1. Argumen eksplisit (nomor dari dialog manual operator)
// 2. Pengaturan tersimpan (diubah oleh admin dengan password)
// 3. Secret Environment Variables (default awal)
// 4. Fallback
export function resolveValidWhatsAppTarget(rawTarget?: string): { target: string; maskedTarget: string; source: "secret" | "argument" | "settings" | "fallback" } {
  const token = (process.env.FONNTE_TOKEN || "").trim();

  // 1. PRIORITAS 1: Argumen eksplisit (misal pengiriman manual ke nomor tertentu dari dialog)
  if (rawTarget && isValidTarget(rawTarget, token)) {
    const cleaned = cleanTargetNumber(rawTarget);
    return { target: cleaned, maskedTarget: maskPhoneNumber(cleaned), source: "argument" };
  }

  // 2. PRIORITAS 2: Konfigurasi melalui antarmuka (Settings yang diubah admin dengan password)
  const settings = getNotifierSettings();
  if (settings.whatsappTarget && isValidTarget(settings.whatsappTarget, token)) {
    const cleaned = cleanTargetNumber(settings.whatsappTarget);
    return { target: cleaned, maskedTarget: maskPhoneNumber(cleaned), source: "settings" };
  }

  // 3. PRIORITAS 3: Nilai dari Secret / Environment Variables
  const secretPhone = (
    process.env.WHATSAPP_TARGET_PHONE ||
    process.env.FONNTE_TARGET_PHONE ||
    process.env.WHATSAPP_TARGET ||
    process.env.FONNTE_TARGET ||
    process.env.WHATSAPP_PHONE ||
    process.env.WA_TARGET ||
    process.env.WA_PHONE ||
    ""
  ).trim();

  if (secretPhone && isValidTarget(secretPhone, token)) {
    const cleaned = cleanTargetNumber(secretPhone);
    return { target: cleaned, maskedTarget: maskPhoneNumber(cleaned), source: "secret" };
  }

  // 4. Fallback bawaan perangkat Fonnte
  return { target: "085821237889", maskedTarget: "0858****7889", source: "fallback" };
}

// Helper untuk kompatibilitas fungsi yang membutuhkan string langsung
export function getWhatsAppTargetString(rawTarget?: string): string {
  return resolveValidWhatsAppTarget(rawTarget).target;
}

function isValidTarget(t: string, token: string): boolean {
  if (!t) return false;
  const str = t.trim();
  // Cegah token API Fonnte tidak sengaja terpasang sebagai nomor tujuan
  if (token && (str === token || str.includes(token) || (token.length > 8 && str.startsWith(token.slice(0, 8))))) {
    return false;
  }
  // Jika berupa ID grup WhatsApp (misal: 12036302482394@g.us)
  if (str.includes("@g.us")) return true;
  // Jika berupa nomor telepon: ambil digit angka saja
  const digits = str.replace(/\D/g, "");
  // Minimal 8 digit dan diawali awalan nomor telepon seluler lazim
  return digits.length >= 8 && (
    digits.startsWith("08") || 
    digits.startsWith("628") || 
    digits.startsWith("8") || 
    digits.startsWith("62")
  );
}

function cleanTargetNumber(t: string): string {
  if (t.includes("@g.us")) return t.trim();
  let digits = t.replace(/[^0-9]/g, "");
  if (digits.startsWith("8")) {
    digits = "0" + digits;
  }
  return digits;
}

// Resolusi target Telegram untuk laporan detak jantung (Heartbeat):
// Sesuai instruksi: HANYA ke akun Telegram pribadi, JANGAN ke grup! User dimasukkan ke secret.
export function resolveTelegramHeartbeatTarget(): {
  chatId: string | null;
  maskedChatId?: string;
  isGroup: boolean;
  statusText: string;
  source?: "secret" | "settings" | "none";
} {
  // 1. Cek Secret untuk User ID Telegram Pribadi
  const secretUser = (
    process.env.TELEGRAM_USER_CHAT_ID ||
    process.env.TELEGRAM_HEARTBEAT_USER_ID ||
    process.env.TELEGRAM_HEARTBEAT_CHAT_ID ||
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.TELEGRAM_USER_ID ||
    process.env.TELEGRAM_ADMIN_ID ||
    process.env.TELEGRAM_PRIVATE_CHAT_ID ||
    ""
  ).trim();

  if (secretUser) {
    if (secretUser.startsWith("-")) {
      return {
        chatId: null,
        maskedChatId: maskTelegramId(secretUser),
        isGroup: true,
        statusText: `Secret berisi ID grup (${maskTelegramId(secretUser)}). Pengiriman heartbeat ke grup DITOLAK sesuai instruksi. Masukkan ID akun pribadi Telegram (angka positif).`
      };
    }
    return {
      chatId: secretUser,
      maskedChatId: maskTelegramId(secretUser),
      isGroup: false,
      statusText: `Akun Telegram Pribadi dari Secret (ID: ${maskTelegramId(secretUser)})`,
      source: "secret"
    };
  }

  // 2. Cek Pengaturan UI jika ada
  const settings = getNotifierSettings();
  if (settings.telegramHeartbeatUser && settings.telegramHeartbeatUser.trim()) {
    const val = settings.telegramHeartbeatUser.trim();
    if (val.startsWith("-")) {
      return {
        chatId: null,
        maskedChatId: maskTelegramId(val),
        isGroup: true,
        statusText: `ID pada pengaturan merupakan ID grup (${maskTelegramId(val)}). Pengiriman ke grup diblokir.`
      };
    }
    return {
      chatId: val,
      maskedChatId: maskTelegramId(val),
      isGroup: false,
      statusText: `Akun Telegram Pribadi dari Pengaturan (ID: ${maskTelegramId(val)})`,
      source: "settings"
    };
  }

  // 3. Cek TELEGRAM_CHAT_ID bawaan: Jika bernilai Grup (diawali tanda minus -), JANGAN kirim heartbeat ke grup!
  const mainChatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (mainChatId.startsWith("-")) {
    return {
      chatId: null,
      maskedChatId: maskTelegramId(mainChatId),
      isGroup: true,
      statusText: `Grup Telegram terdeteksi (${maskTelegramId(mainChatId)}). Laporan detak jantung DILARANG dikirim ke grup. Masukkan User ID pribadi ke Secret TELEGRAM_USER_CHAT_ID.`
    };
  } else if (mainChatId) {
    // Merupakan akun pengguna personal (angka positif)
    return {
      chatId: mainChatId,
      maskedChatId: maskTelegramId(mainChatId),
      isGroup: false,
      statusText: `Akun Pribadi dari TELEGRAM_CHAT_ID (${maskTelegramId(mainChatId)})`,
      source: "secret"
    };
  }

  return {
    chatId: null,
    isGroup: false,
    statusText: "Secret TELEGRAM_USER_CHAT_ID belum dimasukkan."
  };
}

interface StoredHotspot {
  id: string;
  canonicalKey?: string;
  lat: number;
  lng: number;
  detectedAt: string;
  notifiedAt: string;
  location: string;
  zone: string;
  source?: string;
  clusterWith?: string;
  status: "initial_baseline" | "notified" | "failed" | "cluster_duplicate";
  telegramSent: boolean;
  telegramError?: string;
  waSent: boolean;
  waError?: string;
  processDurationSeconds?: number;
}

interface StorageData {
  createdAt: string;
  updatedAt: string;
  lastRunTime?: string | null;
  lastCheckStatus?: string;
  hotspots: Record<string, StoredHotspot>;
}

// In-memory cache of notified IDs for fast lookup
let storageCache: StorageData | null = null;
let lastRunTime: string | null = null;
let lastCheckStatus = "Belum berjalan";
let lastNewCount = 0;
let timerId: NodeJS.Timeout | null = null;

// Mutex & caching for checking cycle
let activeCheckPromise: Promise<{
  checked: number;
  newHotspots: number;
  notified: string[];
}> | null = null;
let cachedFirmsCsv: { data: string[]; timestamp: number } | null = null;
const FIRMS_CACHE_TTL_MS = 60 * 1000; // 60s cache

// Fallback & Health Check Monitoring Counters
let consecutiveNasaFailures = 0;
let nasaOutageAlertSent = false;
let heartbeatTimerId: NodeJS.Timeout | null = null;

// Equatorial approximation for South Kalimantan (lat ~ -2.2°)
function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat1 - lat2) * 111.0;
  const dLng = (lng1 - lng2) * 110.9;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Check whether this exact satellite observation has ALREADY been processed/notified in history
// Strictly prevents repeating the same satellite detection even across container restarts or row reordering.
function isAlreadyProcessedObservation(
  candidate: { id: string; rawKey: string; lat: number; lng: number; detectedAt: Date },
  storage: StorageData
): boolean {
  // 1. Direct ID match
  const byId = storage.hotspots[candidate.id];
  if (byId && (byId.telegramSent || byId.waSent || byId.status === "notified" || byId.status === "cluster_duplicate" || byId.status === "initial_baseline")) {
    return true;
  }

  const candTime = candidate.detectedAt.getTime();

  // 2. Canonical key match and coordinate+pass proximity match
  for (const item of Object.values(storage.hotspots)) {
    if (item.canonicalKey && item.canonicalKey === candidate.rawKey) {
      return true;
    }

    // Physical pixel proximity match (~350m radius and within 30 minutes of the same satellite pass)
    const dist = calculateDistanceKm(candidate.lat, candidate.lng, item.lat, item.lng);
    if (dist <= 0.35) {
      const itemTime = new Date(item.detectedAt || item.notifiedAt).getTime();
      const diffMinutes = Math.abs(candTime - itemTime) / 60000;
      if (diffMinutes <= 30) {
        return true;
      }
    }
  }

  return false;
}

// Find if hotspot belongs to an existing active fire cluster notified within the last 12h & 1.5 km
// Sesuai instruksi:
// - Jika selang waktu dari notifikasi sebelumnya <= 12 jam: fusi ke klaster aktif (anti-duplikasi, return item).
// - Jika durasi waktu lewat dari 12 jam: tetap kirimkan notifikasinya (kebakaran persisten/re-emergence, return null)!
function findExistingRecentCluster(
  lat: number,
  lng: number,
  detectedAt: Date,
  storage: StorageData,
  radiusKm = 1.5,
  windowHours = 12
): StoredHotspot | null {
  const candidateTime = detectedAt.getTime();

  for (const item of Object.values(storage.hotspots)) {
    // Only compare against hotspots that were actually notified!
    if (!item.telegramSent && !item.waSent && item.status !== "notified") {
      continue;
    }

    const dist = calculateDistanceKm(lat, lng, item.lat, item.lng);
    if (dist <= radiusKm) {
      const itemTime = new Date(item.detectedAt || item.notifiedAt).getTime();
      const diffHours = (candidateTime - itemTime) / (1000 * 60 * 60);

      // If within 12 hours (both forward and backward within windowHours),
      // this hotspot belongs to an active, already-notified fire cluster!
      if (Math.abs(diffHours) <= windowHours) {
        return item;
      }
    }
  }

  // If there are no notified hotspots in this 1.5 km area, OR all previous notifications
  // in this area occurred more than 12 hours ago (> 12 jam):
  // Return null to allow dispatching a new notification!
  return null;
}

// Parser for identifying satellite & agency source from row columns
function parseSourceFromRow(cols: string[]): { source: string; satellite: string; agency: string } {
  const sat = (cols[7] || cols[8] || "").trim();
  const inst = (cols[8] || "").trim();

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

  return {
    source: "Multi-Satelit Terintegrasi (Jepang Himawari / BRIN / SiPongi / BMKG)",
    satellite: "Multi-Satelit",
    agency: "Terintegrasi",
  };
}

// Clean records older than 7 days to keep file size optimized
function pruneOldHotspots(storage: StorageData, maxAgeDays = 7) {
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  let pruned = 0;

  for (const [id, item] of Object.entries(storage.hotspots)) {
    const time = new Date(item.detectedAt || item.notifiedAt).getTime();
    if (now - time > maxAgeMs) {
      delete storage.hotspots[id];
      pruned++;
    }
  }

  if (pruned > 0) {
    console.log(`[AutoNotifier] 🧹 Membersihkan ${pruned} rekaman hotspot lama (> 7 hari).`);
  }
}

function ensureStorage(): StorageData {
  if (storageCache) return storageCache;

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.error("[AutoNotifier] Failed to create DATA_DIR:", e);
    }
  }

  // 1. Try reading primary storage file
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
      if (raw && raw.trim().length > 0) {
        storageCache = JSON.parse(raw);
        if (storageCache && typeof storageCache.hotspots === "object") {
          if (storageCache.lastRunTime && !lastRunTime) {
            lastRunTime = storageCache.lastRunTime;
          }
          if (storageCache.lastCheckStatus && lastCheckStatus === "Belum berjalan") {
            lastCheckStatus = storageCache.lastCheckStatus;
          }
          return storageCache;
        }
      }
    } catch (err: any) {
      console.warn("[AutoNotifier] ⚠️ File storage utama rusak / terputus saat crash:", err?.message);
    }
  }

  // 2. Try recovering from backup file if primary is corrupted or empty
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      const bakRaw = fs.readFileSync(BACKUP_FILE, "utf-8");
      if (bakRaw && bakRaw.trim().length > 0) {
        const recovered = JSON.parse(bakRaw);
        if (recovered && typeof recovered.hotspots === "object") {
          console.log("[AutoNotifier] 🛡️ BERHASIL MEMULIHKAN DATA DARI BACKUP OTOMATIS SETELAH KONTINER CRASH/RESTART!");
          storageCache = recovered;
          saveStorage(storageCache);
          return storageCache;
        }
      }
    } catch (bakErr: any) {
      console.error("[AutoNotifier] Backup file juga tidak terbaca:", bakErr?.message);
    }
  }

  // 3. Fallback clean baseline state
  storageCache = {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunTime: null,
    lastCheckStatus: "Siap",
    hotspots: {}
  };
  saveStorage(storageCache);
  return storageCache;
}

function saveStorage(data: StorageData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Time-based retention: prune records older than 7 days
    pruneOldHotspots(data, 7);

    // 2. Bounded size guard: retain at most 1,000 recent hotspots to prevent unbounded memory growth
    const entries = Object.entries(data.hotspots);
    if (entries.length > 1000) {
      entries.sort((a, b) => new Date(b[1].notifiedAt || b[1].detectedAt).getTime() - new Date(a[1].notifiedAt || a[1].detectedAt).getTime());
      const prunedObj: Record<string, StoredHotspot> = {};
      for (const [k, v] of entries.slice(0, 1000)) {
        prunedObj[k] = v;
      }
      data.hotspots = prunedObj;
    }

    data.updatedAt = new Date().toISOString();
    data.lastRunTime = lastRunTime;
    data.lastCheckStatus = lastCheckStatus;

    const payload = JSON.stringify(data, null, 2);

    // 3. ATOMIC WRITE: Write to temporary file first
    fs.writeFileSync(TEMP_FILE, payload, "utf-8");

    // 4. Update backup copy if valid primary file currently exists
    if (fs.existsSync(STORAGE_FILE)) {
      try {
        fs.copyFileSync(STORAGE_FILE, BACKUP_FILE);
      } catch {
        // Non-blocking backup copy
      }
    }

    // 5. Atomic POSIX rename (guarantees file is never half-written or corrupted if killed)
    fs.renameSync(TEMP_FILE, STORAGE_FILE);
    storageCache = data;
  } catch (err) {
    console.error("[AutoNotifier] Gagal menyimpan storage file secara atomik:", err);
  }
}

// Reverse geocode via local database first, then ArcGIS
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const local = findNearestLocalVillage(lat, lng);
  if (local) return local;

  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "HotspotMonitor/1.0" },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return "Wilayah Konsesi IUPK";
    const data = await res.json();
    const addr = data.address || {};
    const ds = addr.Neighborhood || addr.PlaceName || "";
    const kec = addr.City || addr.District || "";
    const kab = addr.Subregion || addr.MetroArea || "";
    const prov = addr.Region || "";

    const parts: string[] = [];
    if (ds) {
      if (ds.toLowerCase().includes("desa") || ds.toLowerCase().includes("kelurahan")) {
        parts.push(ds);
      } else {
        parts.push(`Desa/Kel. ${ds}`);
      }
    }
    if (kec) parts.push(`Kec. ${kec}`);
    if (kab) {
      if (kab.toLowerCase().includes("kabupaten") || kab.toLowerCase().includes("kota")) {
        parts.push(kab);
      } else {
        parts.push(`Kab. ${kab}`);
      }
    }
    if (prov) parts.push(prov);

    return parts.length > 0 ? parts.join(", ") : "Wilayah Sekitar Konsesi";
  } catch {
    return "Wilayah Konsesi IUPK";
  }
}

// Format timestamp to WITA (UTC+8) in standard Indonesian style
function formatWITA(dateObj: Date): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Shift UTC by +8 hours for WITA
  const witaTime = new Date(dateObj.getTime() + 8 * 60 * 60 * 1000);

  const dayName = days[witaTime.getUTCDay()];
  const dateNum = witaTime.getUTCDate();
  const monthName = months[witaTime.getUTCMonth()];
  const year = witaTime.getUTCFullYear();
  const hours = String(witaTime.getUTCHours()).padStart(2, "0");
  const minutes = String(witaTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(witaTime.getUTCSeconds()).padStart(2, "0");

  return `${dayName}, ${dateNum} ${monthName} ${year} ${hours}.${minutes}.${seconds} WITA`;
}

function generateHotspotIdFromNasa(acqDate?: string, acqTime?: string, counter?: number): string {
  const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

  let witaTime: Date;
  if (acqDate && /^\d{4}-\d{2}-\d{2}$/.test(acqDate)) {
    const parts = acqDate.split("-").map(Number);
    const cleanTime = (acqTime || "0000").padStart(4, "0");
    const hours = parseInt(cleanTime.substring(0, 2), 10) || 0;
    const mins = parseInt(cleanTime.substring(2, 4), 10) || 0;
    const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], hours, mins));
    witaTime = new Date(utcDate.getTime() + 8 * 3600000);
  } else {
    witaTime = new Date(Date.now() + 8 * 3600000);
  }

  const dayName = dayNames[witaTime.getUTCDay()];
  const d = String(witaTime.getUTCDate()).padStart(2, "0");
  const m = String(witaTime.getUTCMonth() + 1).padStart(2, "0");
  const y = String(witaTime.getUTCFullYear()).slice(-2);
  const hh = String(witaTime.getUTCHours()).padStart(2, "0");
  const mm = String(witaTime.getUTCMinutes()).padStart(2, "0");

  let id = `HS-${dayName}-${d}${m}${y}-${hh}${mm}`;
  if (counter && counter > 1) {
    id += `-${counter}`;
  }
  return id;
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatLatencyText(sec: number): string {
  if (sec < 60) return `${sec} detik`;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}

// Send alert to Telegram Bot
async function sendTelegramAlert(hotspot: {
  id: string;
  lat: number;
  lng: number;
  location: string;
  date: string;
  zone: string;
  confidence: number;
  source?: string;
  latencySeconds?: number;
}): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { success: false, error: "Token BOT atau Chat ID belum disetel" };
  }

  const zoneLabel =
    hotspot.zone === "iupk"
      ? "Konsesi IUPK (Area Inti Tambang / Pelabuhan Kelanis)"
      : "Buffer Zone (Konsesi / Koridor Hauling Road)";

  const sourceName = hotspot.source || "Multi-Satelit Terintegrasi (Jepang / BRIN / SiPongi / BMKG)";
  const latencyStr = hotspot.latencySeconds ? formatLatencyText(hotspot.latencySeconds) : "";
  const nowWita = formatWITA(new Date());

  const pesanHtml =
    `🚨 <b>PERINGATAN DINI KARHUTLA - DETEKSI OTOMATIS</b> 🚨\n\n` +
    `Sistem mendeteksi adanya anomali termal / titik api baru di area operasional:\n\n` +
    `🔥 <b>ID Hotspot</b>: <code>${escapeHtml(hotspot.id)}</code>\n` +
    `🕒 <b>Waktu Satelit (NASA)</b>: ${escapeHtml(hotspot.date)}\n` +
    `⚡ <b>Waktu Siar Notifikasi</b>: ${escapeHtml(nowWita)}\n` +
    (latencyStr ? `⏱️ <b>Jeda Transit Data</b>: ${escapeHtml(latencyStr)} <i>(Waktu downlink & kalibrasi NASA)</i>\n` : "") +
    `🛰️ <b>Sumber Satelit</b>: ${escapeHtml(sourceName)}\n` +
    `📍 <b>Koordinat</b>: <code>${hotspot.lat}, ${hotspot.lng}</code>\n` +
    `🗺️ <b>Lokasi</b>: ${escapeHtml(hotspot.location)}\n` +
    `🎯 <b>Tingkat Keyakinan</b>: ${hotspot.confidence}%\n` +
    `🛡️ <b>Kategori Wilayah</b>: ${escapeHtml(zoneLabel)}\n\n` +
    `🤖 <b>Status Sistem</b>: Notifikasi otomatis 24/7 (Fusi Klaster 1.5 km / Siklus 12 Jam. Titik api di area yang sama lewat dari 12 jam tetap dikirim ulang).\n` +
    `⚠️ <b>Perhatian Petugas Satgas</b>: Harap segera lakukan verifikasi darat (ground check) di lokasi tersebut.\n\n` +
    `📍 <b>Buka Titik di Google Maps:</b>\n` +
    `https://maps.google.com/?q=${hotspot.lat},${hotspot.lng}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: pesanHtml,
        parse_mode: "HTML"
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[AutoNotifier] Telegram API error:", res.status, errBody);
      return { success: false, error: `HTTP ${res.status}: ${errBody.slice(0, 60)}` };
    }

    console.log(`[AutoNotifier] 📨 Peringatan Telegram terkirim untuk ${hotspot.id}`);
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.name === "TimeoutError" ? "Timeout: Server Telegram tidak merespons" : (err?.message || "Koneksi Telegram gagal");
    console.error("[AutoNotifier] Gagal mengirim peringatan Telegram:", errMsg);
    return { success: false, error: errMsg };
  }
}

// Send alert to WhatsApp via Fonnte if token is present
async function sendWhatsAppAlert(hotspot: {
  id: string;
  lat: number;
  lng: number;
  location: string;
  date: string;
  zone: string;
  confidence: number;
  source?: string;
  latencySeconds?: number;
  target?: string;
}): Promise<{ success: boolean; error?: string }> {
  const fonnteToken = process.env.FONNTE_TOKEN;
  const targetInfo = resolveValidWhatsAppTarget(hotspot.target);
  const target = targetInfo.target;

  if (!fonnteToken || !target) {
    return { success: false, error: "Token Fonnte atau nomor target belum disetel" };
  }

  const zoneLabel =
    hotspot.zone === "iupk"
      ? "Konsesi IUPK (Area Inti)"
      : "Buffer Zone (Konsesi / Koridor Hauling)";

  const sourceName = hotspot.source || "Multi-Satelit Terintegrasi (Jepang / BRIN / SiPongi / BMKG)";
  const latencyStr = hotspot.latencySeconds ? formatLatencyText(hotspot.latencySeconds) : "";
  const nowWita = formatWITA(new Date());

  const pesan =
    `🚨 *PERINGATAN DINI KARHUTLA - DETEKSI OTOMATIS* 🚨\n\n` +
    `Sistem mendeteksi adanya titik api baru di area operasional:\n\n` +
    `🔥 *ID Hotspot*: ${hotspot.id}\n` +
    `🕒 *Waktu Satelit (NASA)*: ${hotspot.date}\n` +
    `⚡ *Waktu Kirim*: ${nowWita}\n` +
    (latencyStr ? `⏱️ *Jeda Transit*: ${latencyStr}\n` : "") +
    `🛰️ *Sumber Satelit*: ${sourceName}\n` +
    `📍 *Koordinat*: ${hotspot.lat}, ${hotspot.lng}\n` +
    `🗺️ *Lokasi*: ${hotspot.location}\n` +
    `🎯 *Keyakinan*: ${hotspot.confidence}%\n` +
    `🛡️ *Zona*: ${zoneLabel}\n` +
    `⚡ *Anti-Duplikasi*: Klaster 1.5km (Pembaruan >12 Jam Tetap Dikirim Ulang)\n\n` +
    `📍 Google Maps: https://maps.google.com/?q=${hotspot.lat},${hotspot.lng}\n\n` +
    `Mohon satgas lapangan segera merespons.`;

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: fonnteToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target,
        message: pesan,
        countryCode: "62"
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === false) {
        return { success: false, error: data.reason || "Ditolak Gateway WhatsApp" };
      }
      console.log(`[AutoNotifier] 📱 Peringatan WhatsApp terkirim untuk ${hotspot.id}`);
      return { success: true };
    }

    const errText = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 60)}` };
  } catch (err: any) {
    const errMsg = err?.name === "TimeoutError" ? "Timeout: Server WhatsApp Gateway tidak merespons" : (err?.message || "Koneksi WhatsApp gagal");
    console.error("[AutoNotifier] Gagal mengirim WhatsApp:", errMsg);
    return { success: false, error: errMsg };
  }
}

// Send consolidated multi-hotspot alert to Telegram Bot (prevents spamming multiple messages in one pass)
async function sendConsolidatedTelegramAlert(hotspots: Array<{
  id: string;
  lat: number;
  lng: number;
  location: string;
  formattedDate: string;
  zone: string;
  confidence: number;
  source?: string;
  durationSec: number;
}>): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { success: false, error: "Token BOT atau Chat ID belum disetel" };
  }

  const nowWita = formatWITA(new Date());

  const itemsHtml = hotspots.map((h, idx) => {
    const zoneLabel = h.zone === "iupk" ? "Konsesi IUPK (Area Inti Tambang)" : "Buffer Zone (Koridor)";
    return `🔥 <b>Titik #${idx + 1}: <code>${escapeHtml(h.id)}</code></b>\n` +
      `📍 <b>Koordinat</b>: <code>${h.lat}, ${h.lng}</code>\n` +
      `🗺️ <b>Lokasi</b>: ${escapeHtml(h.location)}\n` +
      `🎯 <b>Keyakinan</b>: ${h.confidence}% | ${escapeHtml(zoneLabel)}\n` +
      `🛰️ <b>Sumber Satelit</b>: ${escapeHtml(h.source || "Multi-Satelit")}\n` +
      `📍 <a href="https://maps.google.com/?q=${h.lat},${h.lng}">Buka Titik di Google Maps</a>`;
  }).join("\n\n");

  const pesanHtml =
    `🚨 <b>PERINGATAN DINI KARHUTLA - DETEKSI MULTI-TITIK API</b> 🚨\n\n` +
    `Sistem mendeteksi <b>${hotspots.length} titik api baru</b> di area operasional konsesi:\n\n` +
    itemsHtml +
    `\n\n🕒 <b>Waktu Satelit (NASA)</b>: ${escapeHtml(hotspots[0].formattedDate)}\n` +
    `⚡ <b>Waktu Siar Notifikasi</b>: ${escapeHtml(nowWita)}\n` +
    `🤖 <b>Status Sistem</b>: Notifikasi konsolidasi otomatis (Fusi Klaster 1.5 km / Siklus 12 Jam).\n` +
    `⚠️ <b>Perhatian Petugas Satgas</b>: Harap segera lakukan verifikasi darat (ground check) di lokasi-lokasi tersebut.`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: pesanHtml,
        parse_mode: "HTML",
        disable_web_page_preview: true
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[AutoNotifier] Telegram API error:", res.status, errBody);
      return { success: false, error: `HTTP ${res.status}: ${errBody.slice(0, 60)}` };
    }

    console.log(`[AutoNotifier] 📨 Peringatan Konsolidasi Telegram terkirim (${hotspots.length} titik api)`);
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.name === "TimeoutError" ? "Timeout: Server Telegram tidak merespons" : (err?.message || "Koneksi Telegram gagal");
    console.error("[AutoNotifier] Gagal mengirim pesan konsolidasi Telegram:", errMsg);
    return { success: false, error: errMsg };
  }
}

// Send consolidated multi-hotspot alert to WhatsApp via Fonnte
async function sendConsolidatedWhatsAppAlert(
  hotspots: Array<{
    id: string;
    lat: number;
    lng: number;
    location: string;
    formattedDate: string;
    zone: string;
    confidence: number;
    source?: string;
    durationSec: number;
  }>,
  rawTarget?: string
): Promise<{ success: boolean; error?: string }> {
  const fonnteToken = process.env.FONNTE_TOKEN;
  const targetInfo = resolveValidWhatsAppTarget(rawTarget);
  const target = targetInfo.target;

  if (!fonnteToken || !target) {
    return { success: false, error: "Token Fonnte atau nomor target belum disetel" };
  }

  const nowWita = formatWITA(new Date());

  const itemsText = hotspots.map((h, idx) => {
    const zoneLabel = h.zone === "iupk" ? "Konsesi IUPK" : "Buffer Zone";
    return `🔥 *Titik #${idx + 1}: ${h.id}*\n` +
      `📍 Koordinat: ${h.lat}, ${h.lng}\n` +
      `🗺️ Lokasi: ${h.location}\n` +
      `🎯 Keyakinan: ${h.confidence}% (${zoneLabel})\n` +
      `🛰️ Sumber: ${h.source || "Multi-Satelit"}\n` +
      `📍 Maps: https://maps.google.com/?q=${h.lat},${h.lng}`;
  }).join("\n\n");

  const pesan =
    `🚨 *PERINGATAN DINI KARHUTLA - DETEKSI MULTI-TITIK API* 🚨\n\n` +
    `Sistem mendeteksi *${hotspots.length} titik api baru* di area operasional konsesi:\n\n` +
    itemsText +
    `\n\n🕒 *Waktu Satelit (NASA)*: ${hotspots[0].formattedDate}\n` +
    `⚡ *Waktu Kirim*: ${nowWita}\n` +
    `⚡ *Anti-Duplikasi*: Klaster 1.5km (Pembaruan >12 Jam Tetap Dikirim Ulang)\n\n` +
    `Mohon satgas lapangan segera merespons ke lokasi-lokasi tersebut.`;

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: fonnteToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target,
        message: pesan,
        countryCode: "62"
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === false) {
        return { success: false, error: data.reason || "Ditolak Gateway WhatsApp" };
      }
      console.log(`[AutoNotifier] 📱 Peringatan Konsolidasi WhatsApp terkirim (${hotspots.length} titik api)`);
      return { success: true };
    }

    const errText = await res.text().catch(() => "");
    return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 60)}` };
  } catch (err: any) {
    const errMsg = err?.name === "TimeoutError" ? "Timeout: Server WhatsApp Gateway tidak merespons" : (err?.message || "Koneksi WhatsApp gagal");
    console.error("[AutoNotifier] Gagal mengirim pesan konsolidasi WhatsApp:", errMsg);
    return { success: false, error: errMsg };
  }
}

// =========================================================================
// SISTEM FALLBACK, NOTIFIKASI DARURAT KHUSUS, & MONITORING GATEWAY
// =========================================================================

// Kirim peringatan sistem / darurat kegagalan ke grup Telegram
export async function sendTelegramSystemAlert(title: string, messageBody: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[AutoNotifier] TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum disetel.");
    return false;
  }

  const nowWita = formatWITA(new Date());
  const html = 
    `🚨 <b>${escapeHtml(title)}</b> 🚨\n\n` +
    `${messageBody}\n\n` +
    `🕒 <b>Waktu Sistem</b>: ${escapeHtml(nowWita)}\n` +
    `🤖 <i>Pengawas Mandiri & Diagnostik Sistem 24/7</i>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML"
      }),
      signal: AbortSignal.timeout(6000)
    });
    return res.ok;
  } catch (err: any) {
    console.error("[AutoNotifier] Error sendTelegramSystemAlert:", err?.message || err);
    return false;
  }
}

// Periksa status koneksi & kuota gateway notifikasi (Telegram Bot & Fonnte WhatsApp)
export async function checkGatewayStatus(): Promise<{
  telegram: {
    configured: boolean;
    connected: boolean;
    botName?: string;
    botUsername?: string;
    chatIdConfigured: boolean;
    error?: string;
  };
  whatsapp: {
    configured: boolean;
    deviceStatus: "connect" | "disconnect" | "unknown";
    deviceNumber?: string;
    quota?: string;
    expired?: string;
    packageName?: string;
    error?: string;
  };
}> {
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  const fonnteToken = process.env.FONNTE_TOKEN;

  // 1. Verifikasi Telegram Bot API
  let tgResult = {
    configured: Boolean(tgToken && tgChatId),
    connected: false,
    botName: undefined as string | undefined,
    botUsername: undefined as string | undefined,
    chatIdConfigured: Boolean(tgChatId),
    error: undefined as string | undefined
  };

  if (tgToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/getMe`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.result) {
          tgResult.connected = true;
          tgResult.botName = data.result.first_name ? `${data.result.first_name.slice(0, 2)}***` : "Bot";
          tgResult.botUsername = maskBotUsername(data.result.username);
        } else {
          tgResult.error = data.description || "Gagal verifikasi Bot Telegram";
        }
      } else {
        tgResult.error = `HTTP ${res.status}: Gagal memanggil getMe Telegram`;
      }
    } catch (e: any) {
      tgResult.error = e?.message || "Koneksi Telegram timeout";
    }
  } else {
    tgResult.error = "TELEGRAM_BOT_TOKEN belum disetel";
  }

  // 2. Verifikasi Fonnte WhatsApp API (Device Connection & Kuota)
  let waResult = {
    configured: Boolean(fonnteToken),
    deviceStatus: "unknown" as "connect" | "disconnect" | "unknown",
    deviceNumber: undefined as string | undefined,
    quota: undefined as string | undefined,
    expired: undefined as string | undefined,
    packageName: undefined as string | undefined,
    error: undefined as string | undefined
  };

  if (fonnteToken) {
    try {
      const res = await fetch("https://api.fonnte.com/device", {
        method: "POST",
        headers: { Authorization: fonnteToken },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          waResult.deviceStatus = data.device_status === "connect" ? "connect" : "disconnect";
          waResult.deviceNumber = maskPhoneNumber(data.device);
          waResult.quota = String(data.quota ?? "0");
          waResult.expired = data.expired;
          waResult.packageName = data.package;
        } else {
          waResult.error = data.reason || "Fonnte menolak otorisasi token";
        }
      } else {
        waResult.error = `HTTP ${res.status}: Server Fonnte tidak merespons`;
      }
    } catch (e: any) {
      waResult.error = e?.message || "Koneksi Fonnte timeout";
    }
  } else {
    waResult.error = "FONNTE_TOKEN belum disetel";
  }

  return { telegram: tgResult, whatsapp: waResult };
}

// Kirim laporan detak jantung (Health Check Heartbeat) secara komprehensif ke Telegram
export async function sendHeartbeatReport(options: { manual?: boolean } = {}): Promise<{
  success: boolean;
  message: string;
  gateways: any;
  targetInfo?: any;
}> {
  const gateways = await checkGatewayStatus();
  const mem = process.memoryUsage();
  const heapMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const storage = ensureStorage();
  const trackedCount = Object.keys(storage.hotspots).length;
  const uptimeMinutes = Math.floor(process.uptime() / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeRestMinutes = uptimeMinutes % 60;
  const uptimeStr = uptimeHours > 0 ? `${uptimeHours} jam ${uptimeRestMinutes} menit` : `${uptimeMinutes} menit`;
  const nowWita = formatWITA(new Date());

  const tgStatusIcon = gateways.telegram.connected ? "🟢" : "🔴";
  const maskedBot = maskBotUsername(gateways.telegram.botUsername || "bot");
  const tgDesc = gateways.telegram.connected 
    ? `Terhubung (@${maskedBot})` 
    : `Bermasalah (${gateways.telegram.error || "putus"})`;

  const waTargetInfo = resolveValidWhatsAppTarget();
  const heartbeatTarget = resolveTelegramHeartbeatTarget();

  const maskedWa = waTargetInfo.maskedTarget || maskPhoneNumber(waTargetInfo.target);
  const waStatusIcon = gateways.whatsapp.deviceStatus === "connect" ? "🟢" : "🟡";
  const waDesc = gateways.whatsapp.deviceStatus === "connect"
    ? `Terhubung (Target WA: ${maskedWa} [${waTargetInfo.source}], Sisa Kuota: ${gateways.whatsapp.quota || "-"} pesan)`
    : `Terputus / Disconnected (Target WA: ${maskedWa} [${waTargetInfo.source}], Sisa Kuota: ${gateways.whatsapp.quota || "-"} pesan, perlu scan QR di fonnte.com)`;

  const nasaStatusIcon = consecutiveNasaFailures === 0 ? "🟢" : "🔴";
  const nasaDesc = consecutiveNasaFailures === 0
    ? "Normal (Semua sumber satelit VIIRS & MODIS aktif)"
    : `Gangguan (${consecutiveNasaFailures}x gagal berturut-turut)`;

  const typeHeader = options.manual 
    ? "🛠️ <b>UJI COBA DETAK JANTUNG SISTEM (AKUN PRIBADI TELEGRAM)</b> 🛠️" 
    : "💓 <b>LAPORAN DETAK JANTUNG SISTEM (BERKALA 60 MENIT - PRIBADI)</b> 💓";

  const reportText = 
    `${typeHeader}\n\n` +
    `Sistem pemantau karhutla beroperasi mandiri 24/7 di latar belakang.\n\n` +
    `📊 <b>Diagnostik Mesin Pemantau:</b>\n` +
    `• Waktu Pemeriksaan: ${nowWita}\n` +
    `• Durasi Uptime: ${uptimeStr}\n` +
    `• RAM Heap Node.js: ${heapMb} MB (Status: Sehat / Bebas Leak)\n` +
    `• Titik Api Terpantau: ${trackedCount} hotspot aktif\n` +
    `• Interval Pemindaian: Tiap 15 Menit\n` +
    `• Ambang Klaster Ulang: 12 Jam (Hotspot di area sama >12 jam tetap dikirim)\n\n` +
    `🛰️ <b>Konektivitas Satelit NASA:</b>\n` +
    `• Status API: ${nasaStatusIcon} ${nasaDesc}\n\n` +
    `📡 <b>Status Gateway Notifikasi & Kuota:</b>\n` +
    `• Telegram Gateway: ${tgStatusIcon} ${tgDesc}\n` +
    `• WhatsApp (Fonnte): ${waStatusIcon} ${waDesc}\n` +
    `• Target Penerima Heartbeat: 👤 ${heartbeatTarget.statusText}\n\n` +
    `🛡️ <i>Semua proteksi anti-crash, fusi klaster 1.5km/12h, dan penyimpanan atomik aktif.</i>`;

  const token = process.env.TELEGRAM_BOT_TOKEN;

  let sendSuccess = false;
  if (token && heartbeatTarget.chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: heartbeatTarget.chatId,
          text: reportText,
          parse_mode: "HTML"
        }),
        signal: AbortSignal.timeout(6000)
      });
      sendSuccess = res.ok;
      if (sendSuccess) {
        console.log(`[Heartbeat] 💓 Laporan detak jantung sistem (60 menit) berhasil dikirim ke akun pribadi Telegram (${heartbeatTarget.chatId}).`);
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`[Heartbeat] Telegram API menolak pengiriman ke ${heartbeatTarget.chatId}:`, errJson);
      }
    } catch (err: any) {
      console.error("[Heartbeat] Gagal mengirim pesan heartbeat ke Telegram:", err?.message || err);
    }
  } else {
    console.log(`[Heartbeat] ⏸️ Pengiriman laporan detak jantung ke grup DILARANG sesuai instruksi: ${heartbeatTarget.statusText}`);
  }

  return {
    success: sendSuccess,
    message: reportText,
    gateways,
    targetInfo: heartbeatTarget
  };
}

// Mulai penjadwal detak jantung (Heartbeat Daemon) berkala setiap 60 menit
export function startHeartbeatDaemon(intervalMinutes = 60) {
  const envInterval = parseInt(process.env.HEARTBEAT_INTERVAL_MINUTES || "", 10);
  const minutes = !isNaN(envInterval) && envInterval > 0 ? envInterval : intervalMinutes;
  const intervalMs = minutes * 60 * 1000;

  console.log(`[Heartbeat] 💓 Memulai penjadwal laporan detak jantung & kuota gateway (setiap ${minutes} menit)...`);

  if (heartbeatTimerId) clearInterval(heartbeatTimerId);

  // Jadwalkan pengiriman berkala setiap 60 menit
  heartbeatTimerId = setInterval(() => {
    console.log(`[Heartbeat] ⏱️ Mengeksekusi laporan detak jantung berkala (${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar' })} WITA)...`);
    sendHeartbeatReport({ manual: false }).catch((err) => {
      console.error("[Heartbeat] Gagal eksekusi berkala:", err);
    });
  }, intervalMs);

  return heartbeatTimerId;
}

export function stopHeartbeatDaemon() {
  if (heartbeatTimerId) {
    clearInterval(heartbeatTimerId);
    heartbeatTimerId = null;
    console.log("[Heartbeat] Penjadwal detak jantung dihentikan.");
  }
}

export interface CheckCycleOptions {
  sendAlerts?: boolean; // If false, syncs baseline without sending any alerts
}

// Main hotspot check cycle logic
export async function runHotspotCheckCycle(options: CheckCycleOptions = { sendAlerts: true }): Promise<{
  checked: number;
  newHotspots: number;
  notified: string[];
}> {
  if (activeCheckPromise) {
    console.log("[AutoNotifier] Siklus pemantauan sedang berjalan, menggunakan hasil eksekusi aktif...");
    return activeCheckPromise;
  }

  const shouldSendAlerts = options.sendAlerts !== false;

  activeCheckPromise = (async () => {
    lastRunTime = new Date().toISOString();
    const apiKey = process.env.NASA_API_KEY;

    if (!apiKey) {
      lastCheckStatus = "Error: NASA_API_KEY belum dikonfigurasi di server";
      console.warn(`[AutoNotifier] ⚠️ ${lastCheckStatus}`);
      return { checked: 0, newHotspots: 0, notified: [] };
    }

    const storage = ensureStorage();
    const isFirstRunEver = Object.keys(storage.hotspots).length === 0;

    // NASA FIRMS & Multi-Satellite Sources for Mine Concession + Kelanis Port + Hauling Road
    const bbox = "114.85,-2.35,115.65,-2.05";
    const sources = ["VIIRS_SNPP_NRT", "MODIS_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "LANDSAT_NRT"];

    try {
      let csvResults: string[] = [];
      if (cachedFirmsCsv && Date.now() - cachedFirmsCsv.timestamp < FIRMS_CACHE_TTL_MS) {
        csvResults = cachedFirmsCsv.data;
      } else {
        csvResults = await Promise.all(
          sources.map(async (src) => {
            const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${src}/${bbox}/1`;
            try {
              const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
              if (!res.ok) return "";
              return await res.text();
            } catch (err: any) {
              console.warn(`[AutoNotifier] FIRMS fetch gagal untuk ${src}:`, err?.message || err);
              return "";
            }
          })
        );

        // Verification of NASA API response
        const anySuccess = csvResults.some((c) => c && c.includes("latitude"));

        if (!anySuccess) {
          consecutiveNasaFailures++;
          console.warn(`[AutoNotifier] ⚠️ Gagal mengambil data satelit NASA FIRMS (Gagal ke-${consecutiveNasaFailures} berturut-turut).`);

          // Send emergency Telegram alert after 3 consecutive failures
          if (consecutiveNasaFailures === 3 && !nasaOutageAlertSent) {
            nasaOutageAlertSent = true;
            const outageMsg = 
              `Sistem pemantau karhutla mendeteksi <b>kegagalan koneksi ke API satelit NASA FIRMS sebanyak 3 siklus berturut-turut</b>.\n\n` +
              `🔍 <b>Detail Status Insiden:</b>\n` +
              `• Frekuensi Kegagalan: 3 kali berturut-turut\n` +
              `• Dugaan Kendala: Downtime server NASA FIRMS (LANCE/MODAPS), gangguan DNS/jaringan, atau limitasi kueri API Key.\n` +
              `• Tindakan Sistem: Sistem akan tetap mencoba menghubungkan kembali secara otomatis pada siklus 15 menit berikutnya.`;

            sendTelegramSystemAlert("PERINGATAN SISTEM: GAGAL MENGAMBIL DATA NASA 3X BERTURUT-TURUT", outageMsg)
              .then(() => console.log("[AutoNotifier] 🚨 Peringatan darurat kegagalan NASA 3x terkirim ke Telegram."))
              .catch((e) => console.error("[AutoNotifier] Gagal mengirim alert sistem NASA:", e));
          }
        } else {
          // Success from at least one NASA feed: check if recovering from an outage
          if (consecutiveNasaFailures >= 3 && nasaOutageAlertSent) {
            const recoveryMsg = 
              `Koneksi ke API Satelit NASA FIRMS <b>berhasil pulih secara otomatis</b>.\n\n` +
              `✅ <b>Status Terkini:</b>\n` +
              `• Multi-satelit (VIIRS SNPP, NOAA-20, NOAA-21, MODIS Aqua/Terra) aktif merespons.\n` +
              `• Pemantauan anomali termal 24/7 kembali beroperasi normal.`;

            sendTelegramSystemAlert("PEMULIHAN SISTEM: KONEKSI NASA PULIH KEMBALI", recoveryMsg)
              .then(() => console.log("[AutoNotifier] ✅ Notifikasi pemulihan NASA terkirim ke Telegram."))
              .catch(() => {});
          }
          consecutiveNasaFailures = 0;
          nasaOutageAlertSent = false;
        }

        if (csvResults.some((c) => c.length > 0)) {
          cachedFirmsCsv = { data: csvResults, timestamp: Date.now() };
        }
      }

      // 1. Parse and extract all rows into RawCandidate objects
      const rawCandidates: Array<{
        rawKey: string;
        lat: number;
        lng: number;
        confidence: number;
        detectedAt: Date;
        acqDate: string;
        acqTime: string;
        zone: string;
        source: string;
      }> = [];

      const seenRawKeys = new Set<string>();

      for (const text of csvResults) {
        const lines = text.trim().split("\n");
        if (lines.length <= 1) continue;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith("latitude")) continue;

          const cols = line.split(",");
          const lat = parseFloat(cols[0]);
          const lng = parseFloat(cols[1]);
          if (isNaN(lat) || isNaN(lng)) continue;

          const zone = checkHotspotZone(lat, lng);
          if (zone === "outside") continue;

          const rawConf = cols[8] || cols[9] || "50";
          let confidence = 50;
          if (rawConf === "h") confidence = 95;
          else if (rawConf === "n") confidence = 75;
          else if (rawConf === "l") confidence = 30;
          else if (!isNaN(parseInt(rawConf, 10))) confidence = parseInt(rawConf, 10);

          const acqDate = cols[5] || ""; // YYYY-MM-DD
          const acqTime = cols[6] || ""; // HHMM UTC

          let detectedAt = new Date();
          if (acqDate) {
            const parts = acqDate.split("-").map(Number);
            const hours = acqTime ? acqTime.padStart(4, "0").substring(0, 2) : "00";
            const mins = acqTime ? acqTime.padStart(4, "0").substring(2, 4) : "00";
            detectedAt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parseInt(hours, 10), parseInt(mins, 10)));
          }

          // Canonical key representing the physical satellite pixel observation
          const rawKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${acqDate}_${acqTime}`;
          if (seenRawKeys.has(rawKey)) continue;
          seenRawKeys.add(rawKey);

          const srcInfo = parseSourceFromRow(cols);
          rawCandidates.push({
            rawKey,
            lat,
            lng,
            confidence,
            detectedAt,
            acqDate,
            acqTime,
            zone,
            source: srcInfo.source,
          });
        }
      }

      // Sort deterministically: newest first, then by latitude, then longitude
      rawCandidates.sort((a, b) => {
        const timeDiff = b.detectedAt.getTime() - a.detectedAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        if (a.lat !== b.lat) return a.lat - b.lat;
        return a.lng - b.lng;
      });

      // Assign deterministic IDs
      const detectedCandidates: Array<{
        id: string;
        rawKey: string;
        lat: number;
        lng: number;
        confidence: number;
        detectedAt: Date;
        zone: string;
        source: string;
      }> = [];

      const seenIds = new Set<string>();

      for (const rc of rawCandidates) {
        const baseId = generateHotspotIdFromNasa(rc.acqDate, rc.acqTime);
        let id = baseId;
        let counter = 1;
        while (seenIds.has(id)) {
          counter++;
          id = `${baseId}-${counter}`;
        }
        seenIds.add(id);

        detectedCandidates.push({
          id,
          rawKey: rc.rawKey,
          lat: rc.lat,
          lng: rc.lng,
          confidence: rc.confidence,
          detectedAt: rc.detectedAt,
          zone: rc.zone,
          source: rc.source,
        });
      }

      // If explicitly requested to skip alerts (e.g. testing mode or server startup baseline sync)
      if (!shouldSendAlerts) {
        console.log(
          `[AutoNotifier] 📋 Sinkronisasi baseline data hening (tanpa alert): Menemukan ${detectedCandidates.length} titik api.`
        );
        for (const c of detectedCandidates) {
          // If not already in storage, record silently
          if (!storage.hotspots[c.id]) {
            const alreadyExists = Object.values(storage.hotspots).some(h => 
              (h.canonicalKey && h.canonicalKey === c.rawKey) ||
              (calculateDistanceKm(c.lat, c.lng, h.lat, h.lng) <= 0.35 &&
               Math.abs(c.detectedAt.getTime() - new Date(h.detectedAt).getTime()) <= 30 * 60 * 1000)
            );
            if (!alreadyExists) {
              storage.hotspots[c.id] = {
                id: c.id,
                canonicalKey: c.rawKey,
                lat: c.lat,
                lng: c.lng,
                detectedAt: c.detectedAt.toISOString(),
                notifiedAt: new Date().toISOString(),
                location: findNearestLocalVillage(c.lat, c.lng) || "Wilayah Operasional",
                zone: c.zone,
                source: c.source,
                status: "initial_baseline",
                telegramSent: false,
                waSent: false,
                processDurationSeconds: Math.max(0, Math.round((new Date().getTime() - c.detectedAt.getTime()) / 1000))
              };
            }
          }
        }
        lastCheckStatus = `Sinkronisasi baseline selesai: ${detectedCandidates.length} hotspot tercatat aman tanpa alert.`;
        lastNewCount = 0;
        saveStorage(storage);
        return { checked: detectedCandidates.length, newHotspots: 0, notified: [] };
      }

      // FILTERING GENUINE NEW HOTSPOTS:
      // Rule 1: Must NOT be an already processed/notified observation (by ID, canonicalKey, or proximity to stored observation).
      // Rule 2: Must NOT be part of an active cluster notified within 1.5 km in the last 12 hours.
      // (Sesuai instruksi: jika durasi waktu lewat dari 12 jam, tetap kirimkan notifikasinya!)
      const genuineNewHotspots: typeof detectedCandidates = [];

      for (const candidate of detectedCandidates) {
        // Step 1: Check if this EXACT observation was already processed or notified in history
        if (isAlreadyProcessedObservation(candidate, storage)) {
          continue; // Strictly NEVER re-notify an observation that was already processed or notified!
        }

        // Step 2: Check if this hotspot is within 1.5 km of an active fire cluster notified in the last 12 hours
        const existingCluster = findExistingRecentCluster(
          candidate.lat,
          candidate.lng,
          candidate.detectedAt,
          storage,
          1.5,
          12 // Ambang batas 12 jam
        );

        if (existingCluster) {
          // Within 12h of an active notified cluster! Record as cluster_duplicate without duplicate alert
          storage.hotspots[candidate.id] = {
            id: candidate.id,
            canonicalKey: candidate.rawKey,
            lat: candidate.lat,
            lng: candidate.lng,
            detectedAt: candidate.detectedAt.toISOString(),
            notifiedAt: new Date().toISOString(),
            location: existingCluster.location || "Wilayah Operasional",
            zone: candidate.zone,
            source: candidate.source,
            clusterWith: existingCluster.id,
            status: "cluster_duplicate",
            telegramSent: false,
            waSent: false,
            processDurationSeconds: Math.max(0, Math.round((new Date().getTime() - candidate.detectedAt.getTime()) / 1000))
          };
          console.log(`[AutoNotifier] 🛡️ Anti-duplikasi klaster: Hotspot ${candidate.id} (${candidate.source}) terfusi dengan klaster aktif ${existingCluster.id} (durasi < 12 jam). Notifikasi berulang dicegah.`);
          continue;
        }

        // Step 3: Check if this candidate fuses with another leader in this current cycle (1.5 km radius)
        const matchingLeader = genuineNewHotspots.find((c) => {
          return calculateDistanceKm(candidate.lat, candidate.lng, c.lat, c.lng) <= 1.5;
        });

        if (matchingLeader) {
          storage.hotspots[candidate.id] = {
            id: candidate.id,
            canonicalKey: candidate.rawKey,
            lat: candidate.lat,
            lng: candidate.lng,
            detectedAt: candidate.detectedAt.toISOString(),
            notifiedAt: new Date().toISOString(),
            location: "Wilayah Operasional",
            zone: candidate.zone,
            source: candidate.source,
            clusterWith: matchingLeader.id,
            status: "cluster_duplicate",
            telegramSent: false,
            waSent: false,
            processDurationSeconds: Math.max(0, Math.round((new Date().getTime() - candidate.detectedAt.getTime()) / 1000))
          };
          console.log(`[AutoNotifier] 🛡️ Fusi klaster siklus ini: Hotspot ${candidate.id} terfusi dengan klaster baru ${matchingLeader.id}.`);
          continue;
        }

        // Step 4: GENUINE NEW CLUSTER LEADER (either newly detected area or rekindled after >12 hours)
        genuineNewHotspots.push(candidate);
      }

      const notifiedIds: string[] = [];

      if (genuineNewHotspots.length > 0) {
        console.log(
          `[AutoNotifier] 🚨 TERDETEKSI ${genuineNewHotspots.length} TITIK API BARU (DI LUAR KLASTER AKTIF 12 JAM)! Mengirim notifikasi otomatis...`
        );

        if (genuineNewHotspots.length === 1) {
          // Exactly 1 new hotspot cluster: send clean individual alert
          const h = genuineNewHotspots[0];
          const locationName = await reverseGeocode(h.lat, h.lng);
          const formattedDate = formatWITA(h.detectedAt);
          const durationSec = Math.max(0, Math.round((Date.now() - h.detectedAt.getTime()) / 1000));

          const tgRes = await sendTelegramAlert({
            id: h.id,
            lat: h.lat,
            lng: h.lng,
            location: locationName,
            date: formattedDate,
            zone: h.zone,
            confidence: h.confidence,
            source: h.source,
            latencySeconds: durationSec
          });

          const waRes = await sendWhatsAppAlert({
            id: h.id,
            lat: h.lat,
            lng: h.lng,
            location: locationName,
            date: formattedDate,
            zone: h.zone,
            confidence: h.confidence,
            source: h.source,
            latencySeconds: durationSec
          });

          const isFullyFailed = !tgRes.success && !waRes.success;
          const statusValue = isFullyFailed ? "failed" : "notified";

          storage.hotspots[h.id] = {
            id: h.id,
            canonicalKey: h.rawKey,
            lat: h.lat,
            lng: h.lng,
            detectedAt: h.detectedAt.toISOString(),
            notifiedAt: new Date().toISOString(),
            location: locationName,
            zone: h.zone,
            source: h.source,
            status: statusValue,
            telegramSent: tgRes.success,
            telegramError: tgRes.error,
            waSent: waRes.success,
            waError: waRes.error,
            processDurationSeconds: durationSec
          };

          if (tgRes.success || waRes.success) {
            notifiedIds.push(h.id);
          }
        } else {
          // Multiple new hotspot clusters in this cycle: send 1 consolidated alert to prevent message flooding
          const enriched = await Promise.all(
            genuineNewHotspots.map(async (h) => {
              const locationName = await reverseGeocode(h.lat, h.lng);
              const formattedDate = formatWITA(h.detectedAt);
              const durationSec = Math.max(0, Math.round((Date.now() - h.detectedAt.getTime()) / 1000));
              return {
                ...h,
                location: locationName,
                formattedDate,
                durationSec
              };
            })
          );

          const tgRes = await sendConsolidatedTelegramAlert(enriched);
          const waRes = await sendConsolidatedWhatsAppAlert(enriched);

          for (const item of enriched) {
            const isFullyFailed = !tgRes.success && !waRes.success;
            const statusValue = isFullyFailed ? "failed" : "notified";

            storage.hotspots[item.id] = {
              id: item.id,
              canonicalKey: item.rawKey,
              lat: item.lat,
              lng: item.lng,
              detectedAt: item.detectedAt.toISOString(),
              notifiedAt: new Date().toISOString(),
              location: item.location,
              zone: item.zone,
              source: item.source,
              status: statusValue,
              telegramSent: tgRes.success,
              telegramError: tgRes.error,
              waSent: waRes.success,
              waError: waRes.error,
              processDurationSeconds: item.durationSec
            };

            if (tgRes.success || waRes.success) {
              notifiedIds.push(item.id);
            }
          }
        }

        lastCheckStatus = `Sukses: ${genuineNewHotspots.length} hotspot baru terdeteksi dan notifikasi otomatis dikirim.`;
        saveStorage(storage);
      } else {
        lastCheckStatus = `Pemeriksaan selesai: Tidak ada titik api baru di area konsesi (${detectedCandidates.length} hotspot aktif terpantau aman).`;
        saveStorage(storage);
      }

      lastNewCount = genuineNewHotspots.length;
      return {
        checked: detectedCandidates.length,
        newHotspots: genuineNewHotspots.length,
        notified: notifiedIds
      };
    } catch (err: any) {
      lastCheckStatus = `Error pemeriksaan: ${err?.message || err}`;
      console.error("[AutoNotifier] Error saat menjalankan siklus pemantauan:", err);
      return { checked: 0, newHotspots: 0, notified: [] };
    }
  })().finally(() => {
    activeCheckPromise = null;
  });

  return activeCheckPromise;
}

// Start autonomous background scheduler
export function startAutoNotifier(intervalMinutes = 15) {
  const envInterval = parseInt(process.env.AUTO_NOTIFY_INTERVAL_MINUTES || "", 10);
  const minutes = !isNaN(envInterval) && envInterval > 0 ? envInterval : intervalMinutes;
  const intervalMs = minutes * 60 * 1000;

  console.log(
    `[AutoNotifier] 🛡️ Memulai Layanan Pemantauan Otomatis Karhutla 24/7 (Interval Standar: setiap ${minutes} menit)...`
  );

  // Run baseline data synchronization on server startup (silent sync without sending alerts)
  // Ensures opening the web application or restarting the server never re-dispatches old alerts!
  setTimeout(() => {
    console.log("[AutoNotifier] 🚀 Sinkronisasi baseline data awal pada startup server (tanpa alert)...");
    runHotspotCheckCycle({ sendAlerts: false })
      .then((res) => {
        console.log(
          `[AutoNotifier] Baseline startup selesai: ${res.checked} hotspot dipindai & disinkronkan aman tanpa alert.`
        );
      })
      .catch((err) => {
        console.error("[AutoNotifier] Kesalahan sinkronisasi awal:", err);
      });
  }, 2500);

  // Jadwalkan pengecekan otomatis mandiri 24/7 di latar belakang
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    console.log(`[AutoNotifier] ⏱️ Siklus pemantauan berkala 24/7 (${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar' })} WITA)...`);
    runHotspotCheckCycle({ sendAlerts: true })
      .then((res) => {
        if (res.newHotspots > 0) {
          console.log(`[AutoNotifier] 🚨 ${res.newHotspots} hotspot baru terdeteksi & notifikasi otomatis terkirim: ${res.notified.join(", ")}`);
        }
      })
      .catch((err) => {
        console.error("[AutoNotifier] Error siklus berkala:", err);
      });
  }, intervalMs);

  return timerId;
}

// Stop autonomous background scheduler
export function stopAutoNotifier() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log("[AutoNotifier] Layanan pemantau latar belakang dihentikan.");
  }
  stopHeartbeatDaemon();
}

// Status query function for API
export function getAutoNotifierStatus(): AutoNotifierStatus {
  const storage = ensureStorage();
  const allList = Object.values(storage.hotspots);

  // Sort newest notified first
  allList.sort((a, b) => new Date(b.notifiedAt).getTime() - new Date(a.notifiedAt).getTime());

  const recent = allList.slice(0, 100).map((h) => ({
    id: h.id,
    lat: h.lat,
    lng: h.lng,
    detectedAt: h.detectedAt,
    notifiedAt: h.notifiedAt,
    location: h.location,
    zone: h.zone,
    status: h.status,
    source: h.source || "Multi-Satelit Terintegrasi",
    telegramSent: Boolean(h.telegramSent),
    telegramError: h.telegramError,
    waSent: Boolean(h.waSent),
    waError: h.waError,
    processDurationSeconds: h.processDurationSeconds ?? (h.detectedAt && h.notifiedAt ? Math.max(0, Math.round((new Date(h.notifiedAt).getTime() - new Date(h.detectedAt).getTime()) / 1000)) : undefined),
    clusterWith: h.clusterWith
  }));

  const envInterval = parseInt(process.env.AUTO_NOTIFY_INTERVAL_MINUTES || "", 10);
  const minutes = !isNaN(envInterval) && envInterval > 0 ? envInterval : 15;

  const waTarget = resolveValidWhatsAppTarget();
  const tgHeartbeat = resolveTelegramHeartbeatTarget();

  return {
    enabled: true,
    intervalMinutes: minutes,
    clusterWindowHours: 12,
    lastRunTime,
    lastCheckStatus,
    newHotspotsDetectedLastRun: lastNewCount,
    totalTrackedHotspots: allList.length,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    whatsappConfigured: Boolean(process.env.FONNTE_TOKEN),
    whatsappTarget: waTarget.maskedTarget,
    whatsappTargetSource: waTarget.source,
    telegramHeartbeatTarget: {
      ...tgHeartbeat,
      chatId: tgHeartbeat.maskedChatId || (tgHeartbeat.chatId ? maskTelegramId(tgHeartbeat.chatId) : null)
    },
    telegramChatIdMasked: maskTelegramId(process.env.TELEGRAM_CHAT_ID),
    consecutiveNasaFailures,
    nasaOutageAlertSent,
    heartbeatDaemonActive: Boolean(heartbeatTimerId),
    recentNotifications: recent
  };
}

export function recordManualNotification(entry: {
  id: string;
  lat: number;
  lng: number;
  location: string;
  zone: string;
  channel: "telegram" | "whatsapp";
  success: boolean;
  error?: string;
  detectedAt?: string;
  source?: string;
}) {
  try {
    const storage = ensureStorage();
    const existing = storage.hotspots[entry.id];
    const nowIso = new Date().toISOString();
    const detIso = entry.detectedAt || nowIso;
    const durSec = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(detIso).getTime()) / 1000));

    if (existing) {
      if (entry.channel === "telegram") {
        existing.telegramSent = entry.success;
        existing.telegramError = entry.error;
      } else {
        existing.waSent = entry.success;
        existing.waError = entry.error;
      }
      if (!entry.success && !existing.telegramSent && !existing.waSent) {
        existing.status = "failed";
      }
      saveStorage(storage);
    } else {
      storage.hotspots[entry.id] = {
        id: entry.id,
        lat: entry.lat,
        lng: entry.lng,
        detectedAt: detIso,
        notifiedAt: nowIso,
        location: entry.location,
        zone: entry.zone,
        source: entry.source || "Manual Dispatch",
        status: entry.success ? "notified" : "failed",
        telegramSent: entry.channel === "telegram" ? entry.success : false,
        telegramError: entry.channel === "telegram" ? entry.error : undefined,
        waSent: entry.channel === "whatsapp" ? entry.success : false,
        waError: entry.channel === "whatsapp" ? entry.error : undefined,
        processDurationSeconds: durSec
      };
      saveStorage(storage);
    }
  } catch (err) {
    console.error("[AutoNotifier] Gagal mencatat manual notification:", err);
  }
}

// Coba kirim ulang notifikasi yang sempat gagal (misal akibat nomor tujuan salah format atau koneksi sesaat)
export async function retryFailedNotifications(): Promise<{
  retried: number;
  telegramSuccess: number;
  waSuccess: number;
}> {
  const storage = ensureStorage();
  const entries = Object.values(storage.hotspots);
  let retried = 0;
  let tgCount = 0;
  let waCount = 0;

  for (const h of entries) {
    // Jangan coba ulang jika klaster duplikat atau initial baseline
    if (h.status === "cluster_duplicate" || h.status === "initial_baseline") continue;
    
    // Batasi ke 24 jam terakhir agar relevan
    const isOld = Date.now() - new Date(h.detectedAt || h.notifiedAt).getTime() > 24 * 60 * 60 * 1000;
    if (isOld) continue;

    const needTg = !h.telegramSent;
    const needWa = !h.waSent;

    if (!needTg && !needWa) continue;

    retried++;
    const formattedDate = formatWITA(new Date(h.detectedAt));
    const locationName = h.location || (await reverseGeocode(h.lat, h.lng));

    if (needTg) {
      const tgRes = await sendTelegramAlert({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        location: locationName,
        date: formattedDate,
        zone: h.zone,
        confidence: 85,
        source: h.source
      });
      if (tgRes.success) {
        h.telegramSent = true;
        h.telegramError = undefined;
        tgCount++;
      } else {
        h.telegramError = tgRes.error;
      }
    }

    if (needWa) {
      const waRes = await sendWhatsAppAlert({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        location: locationName,
        date: formattedDate,
        zone: h.zone,
        confidence: 85,
        source: h.source
      });
      if (waRes.success) {
        h.waSent = true;
        h.waError = undefined;
        waCount++;
      } else {
        h.waError = waRes.error;
      }
    }

    if (h.telegramSent || h.waSent) {
      h.status = "notified";
    }
  }

  if (retried > 0) {
    saveStorage(storage);
    console.log(`[AutoNotifier] 🔄 Mencoba ulang ${retried} notifikasi: Telegram berhasil ${tgCount}, WhatsApp berhasil ${waCount}`);
  }

  return { retried, telegramSuccess: tgCount, waSuccess: waCount };
}

// System Diagnostics & Memory Monitor
export function getSystemDiagnostics() {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
  const heapTotalMb = Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10;
  const rssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10;
  const externalMb = Math.round((mem.external / 1024 / 1024) * 10) / 10;

  const storage = ensureStorage();
  const trackedCount = Object.keys(storage.hotspots).length;

  const memStatus = heapUsedMb > 300 ? "CRITICAL" : heapUsedMb > 180 ? "WARNING" : "HEALTHY";

  return {
    status: "ok",
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      heapUsedMb,
      heapTotalMb,
      rssMb,
      externalMb,
      status: memStatus,
      safeLimitMb: 350
    },
    crashProtection: {
      uncaughtExceptionCatching: true,
      unhandledRejectionCatching: true,
      atomicStorage: true,
      backupFileActive: fs.existsSync(BACKUP_FILE),
      autoRecoveryCapable: true,
      storageRetentionDays: 7,
      trackedHotspotsCount: trackedCount,
      storageLimitCap: 1000
    },
    autoNotifier: {
      enabled: true,
      intervalMinutes: 15,
      clusterWindowHours: 12,
      lastRunTime,
      lastCheckStatus,
      daemonActive: Boolean(timerId),
      consecutiveNasaFailures,
      nasaOutageAlertSent,
      heartbeatDaemonActive: Boolean(heartbeatTimerId),
      resolvedWhatsAppTarget: resolveValidWhatsAppTarget().maskedTarget,
      maskedWhatsAppTarget: resolveValidWhatsAppTarget().maskedTarget,
      resolvedWhatsAppSource: resolveValidWhatsAppTarget().source,
      telegramHeartbeatTarget: {
        ...resolveTelegramHeartbeatTarget(),
        chatId: resolveTelegramHeartbeatTarget().maskedChatId || (resolveTelegramHeartbeatTarget().chatId ? maskTelegramId(resolveTelegramHeartbeatTarget().chatId) : null)
      }
    }
  };
}

