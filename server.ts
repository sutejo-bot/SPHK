import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  startAutoNotifier, 
  stopAutoNotifier,
  getAutoNotifierStatus, 
  runHotspotCheckCycle, 
  recordManualNotification,
  getSystemDiagnostics,
  startHeartbeatDaemon,
  stopHeartbeatDaemon,
  sendHeartbeatReport,
  checkGatewayStatus,
  resolveValidWhatsAppTarget,
  resolveTelegramHeartbeatTarget,
  getNotifierSettings,
  saveNotifierSettings,
  getEffectiveAdminPassword,
  retryFailedNotifications
} from "./src/server/autoNotifier";
import { maskPhoneNumber, maskTelegramId } from "./src/utils";

// =========================================================================
// ANTISIPASI MEMORY LEAK & CRASH KONTINER (PROCESS-LEVEL CRASH GUARDS)
// =========================================================================
process.on("uncaughtException", (err) => {
  console.error("[CRASH GUARD] ⚠️ Uncaught Exception dicegah agar kontainer tidak crash:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRASH GUARD] ⚠️ Unhandled Promise Rejection dicegah:", reason);
});

// Bounded LRU Cache to strictly prevent memory leaks
class BoundedCache<K, V> {
  private map = new Map<K, { value: V; expiresAt: number }>();
  constructor(private maxEntries: number, private defaultTtlMs: number) {}

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      // Evict oldest entry (first key in map)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  pruneExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [k, v] of this.map.entries()) {
      if (now > v.expiresAt) {
        this.map.delete(k);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Bounded in-memory cache for NASA FIRMS data (max 30 queries, 5 min TTL)
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const firmsCache = new BoundedCache<number, { data: string; timestamp: number }>(30, CACHE_TTL_MS);

  // Bounded in-memory cache for reverse geocoding results (max 500 coordinates, 24 hr TTL)
  const geocodeServerCache = new BoundedCache<string, any>(500, 24 * 60 * 60 * 1000);

  // Periodic memory watchdog and expired cache eviction (runs every 10 min)
  setInterval(() => {
    const p1 = firmsCache.pruneExpired();
    const p2 = geocodeServerCache.pruneExpired();
    if (p1 > 0 || p2 > 0) {
      console.log(`[Memory Guard] 🧹 Membersihkan entri kadaluwarsa (FIRMS: ${p1}, Geocode: ${p2}).`);
    }

    // Monitor Node.js heap memory
    const mem = process.memoryUsage();
    const heapMb = mem.heapUsed / 1024 / 1024;
    if (heapMb > 280) {
      console.warn(`[Memory Guard] ⚠️ Konsumsi RAM heap meningkat (${heapMb.toFixed(1)}MB). Mengosongkan cache in-memory untuk membebaskan RAM.`);
      geocodeServerCache.clear();
      firmsCache.clear();
      if (typeof global.gc === "function") {
        try { global.gc(); } catch {}
      }
    }
  }, 10 * 60 * 1000).unref();

  // Helper to generate date chunks for NASA FIRMS (max 5 days per request)
  function getFirmsChunks(days: number) {
    const chunks: { date: string; range: number }[] = [];
    const today = new Date();
    const cur = new Date(today);
    cur.setDate(cur.getDate() - (days - 1));
    let remaining = days;
    while (remaining > 0) {
      const take = Math.min(remaining, 5);
      const dateStr = cur.toISOString().split("T")[0];
      chunks.push({ date: dateStr, range: take });
      cur.setDate(cur.getDate() + take);
      remaining -= take;
    }
    return chunks;
  }

  // API route for sending WhatsApp notifications via Fonnte
  app.post("/api/notify-wa", async (req, res) => {
    try {
      const { target, lat, lng, location, date, id, source, hotspotSource, confidence, zone } = req.body;
      const token = process.env.FONNTE_TOKEN;
      
      if (!token) {
        return res.status(500).json({ error: "Token Fonnte belum dikonfigurasi. Harap tambahkan 'FONNTE_TOKEN' pada menu Environment Variables di pengaturan Netlify Anda." });
      }

      const isAuto = source === 'auto';
      const header = isAuto 
        ? `🚨 *DARURAT KARHUTLA - DETEKSI OTOMATIS* 🚨` 
        : `🚨 *DARURAT KARHUTLA - PENGIRIMAN MANUAL* 🚨`;

      const statusText = isAuto
        ? `🤖 *Status*: Notifikasi ini dikirim secara otomatis oleh sistem 24/7.`
        : `👤 *Status*: Notifikasi ini dikirim secara manual oleh operator.`;

      const zoneText = zone === 'iupk' 
        ? 'Konsesi IUPK (Area Inti Operasi)' 
        : (zone === 'buffer' ? 'Buffer Zone (Koridor Penunjang)' : 'Sekitar Wilayah Operasional');

      const sourceText = hotspotSource || 'Multi-Satelit Terintegrasi (Jepang / BRIN / SiPongi / BMKG)';

      const pesan = `${header}\n\n` +
        `🔥 *ID Hotspot*: ${id}\n` +
        `🕒 *Waktu Satelit (NASA)*: ${date}\n` +
        `🛰️ *Sumber Satelit*: ${sourceText}\n` +
        `📍 *Koordinat*: ${lat}, ${lng}\n` +
        `🗺️ *Lokasi*: ${location || 'Sedang dimuat...'}\n` +
        `🛡️ *Zona*: ${zoneText}\n\n` +
        `${statusText}\n` +
        `Segera lakukan pengecekan ke lokasi!\n\n` +
        `📍 *Buka Peta:*\nhttps://maps.google.com/?q=${lat},${lng}`;

      const targetPhone = resolveValidWhatsAppTarget(target).target;

      const formData = new URLSearchParams();
      formData.append('target', targetPhone);
      formData.append('message', pesan);
      formData.append('countryCode', '62');

      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const errText = await response.text();
        recordManualNotification({
          id: id || `HS-MANUAL-${Date.now()}`,
          lat: Number(lat) || -2.2,
          lng: Number(lng) || 115.4,
          location: location || "Wilayah Operasional",
          zone: zone || "buffer",
          channel: "whatsapp",
          success: false,
          error: `HTTP ${response.status}: ${errText.slice(0, 60)}`
        });
        return res.status(response.status).json({ error: errText });
      }

      const data = await response.json();
      
      // Fonnte sometimes returns HTTP 200 but status inside JSON is false
      if (data.status === false) {
        recordManualNotification({
          id: id || `HS-MANUAL-${Date.now()}`,
          lat: Number(lat) || -2.2,
          lng: Number(lng) || 115.4,
          location: location || "Wilayah Operasional",
          zone: zone || "buffer",
          channel: "whatsapp",
          success: false,
          error: data.reason || "Ditolak Gateway WhatsApp Fonnte"
        });
        return res.status(400).json({ error: data.reason || "Fonnte API rejected the request." });
      }

      recordManualNotification({
        id: id || `HS-MANUAL-${Date.now()}`,
        lat: Number(lat) || -2.2,
        lng: Number(lng) || 115.4,
        location: location || "Wilayah Operasional",
        zone: zone || "buffer",
        channel: "whatsapp",
        success: true
      });

      res.json({
        ...data,
        target: maskPhoneNumber(targetPhone)
      });
    } catch (error: any) {
      console.error("Error sending WA:", error);
      res.status(500).json({ error: error.message || "Failed to send WhatsApp message" });
    }
  });

  // API route for sending Telegram notifications
  app.post("/api/notify-telegram", async (req, res) => {
    try {
      const { lat, lng, location, date, id, source, hotspotSource, confidence, zone } = req.body;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      
      if (!token || !chatId) {
        return res.status(500).json({ error: "Token atau Chat ID Telegram belum dikonfigurasi. Harap tambahkan 'TELEGRAM_BOT_TOKEN' dan 'TELEGRAM_CHAT_ID' di menu Environment Variables." });
      }

      const isAuto = source === 'auto';
      const header = isAuto 
        ? `🚨 *PERINGATAN DINI KARHUTLA - DETEKSI OTOMATIS* 🚨` 
        : `🚨 *PERINGATAN DINI KARHUTLA - PENGIRIMAN MANUAL* 🚨`;

      const statusText = isAuto
        ? `🤖 *Status*: Notifikasi ini dikirim secara otomatis oleh server pemantau satelit 24/7.`
        : `👤 *Status*: Notifikasi ini dikirim secara manual oleh operator melalui dashboard aplikasi.`;

      const zoneText = zone === 'iupk' 
        ? 'Konsesi IUPK (Area Inti Operasi)' 
        : (zone === 'buffer' ? 'Buffer Zone (Koridor Penunjang)' : 'Sekitar Wilayah Operasional');

      const confText = confidence ? `\n🎯 *Keyakinan*: ${confidence}%` : '';
      const sourceText = hotspotSource || 'Multi-Satelit Terintegrasi (Jepang / BRIN / SiPongi / BMKG)';

      const pesan = `${header}\n\n` +
        `🔥 *ID Hotspot*: \`${id}\`\n` +
        `🕒 *Waktu Satelit (NASA)*: ${date}${confText}\n` +
        `🛰️ *Sumber Satelit*: ${sourceText}\n` +
        `📍 *Koordinat*: \`${lat}, ${lng}\`\n` +
        `🗺️ *Lokasi*: ${location || 'Sedang dimuat...'}\n` +
        `🛡️ *Kategori Wilayah*: ${zoneText}\n\n` +
        `${statusText}\n` +
        `⚠️ *Tindakan Petugas*: Segera koordinasikan dengan posko satgas terdekat untuk pengecekan lokasi!\n\n` +
        `📍 *Buka Titik di Google Maps:*\nhttps://maps.google.com/?q=${lat},${lng}`;

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: pesan,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        recordManualNotification({
          id: id || `HS-MANUAL-${Date.now()}`,
          lat: Number(lat) || -2.2,
          lng: Number(lng) || 115.4,
          location: location || "Wilayah Operasional",
          zone: zone || "buffer",
          channel: "telegram",
          success: false,
          error: `HTTP ${response.status}: ${errText.slice(0, 60)}`
        });
        return res.status(response.status).json({ error: errText });
      }

      const data = await response.json();
      recordManualNotification({
        id: id || `HS-MANUAL-${Date.now()}`,
        lat: Number(lat) || -2.2,
        lng: Number(lng) || 115.4,
        location: location || "Wilayah Operasional",
        zone: zone || "buffer",
        channel: "telegram",
        success: true
      });

      res.json(data);
    } catch (error: any) {
      console.error("Error sending Telegram:", error);
      res.status(500).json({ error: error.message || "Failed to send Telegram message" });
    }
  });

  // API route to get auto-notifier status
  app.get("/api/auto-notify/status", (req, res) => {
    try {
      res.setHeader("Content-Type", "application/json");
      res.json(getAutoNotifierStatus());
    } catch (err: any) {
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ error: err.message || "Failed to get status" });
    }
  });

  // API route to get comprehensive audit logs
  app.get("/api/auto-notify/logs", (req, res) => {
    try {
      res.setHeader("Content-Type", "application/json");
      const status = getAutoNotifierStatus();
      res.json({
        success: true,
        logs: status.recentNotifications,
        stats: {
          totalTracked: status.totalTrackedHotspots,
          lastRunTime: status.lastRunTime,
          intervalMinutes: status.intervalMinutes,
          telegramConfigured: status.telegramConfigured,
          whatsappConfigured: status.whatsappConfigured,
          lastCheckStatus: status.lastCheckStatus
        }
      });
    } catch (err: any) {
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ success: false, error: err.message || "Failed to get logs" });
    }
  });

  // API route for system health diagnostics (memory, container crash guard, cache stats)
  app.get(["/api/health", "/api/system-diagnostics"], (req, res) => {
    try {
      const diag = getSystemDiagnostics();
      res.setHeader("Content-Type", "application/json");
      res.json({
        ...diag,
        caches: {
          firmsEntries: firmsCache.size,
          firmsLimit: 30,
          geocodeEntries: geocodeServerCache.size,
          geocodeLimit: 500,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API routes to trigger 24/7 background check (supports GET & POST for external cron/UptimeRobot keep-alive)
  app.all(["/api/auto-notify/run", "/api/cron"], async (req, res) => {
    try {
      const result = await runHotspotCheckCycle({ sendAlerts: true });
      const status = getAutoNotifierStatus();
      res.setHeader("Content-Type", "application/json");
      res.json({ 
        success: true, 
        message: "24/7 Background Hotspot Engine active", 
        result, 
        status 
      });
    } catch (error: any) {
      console.error("[API Error] /api/auto-notify/run:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ success: false, error: error?.message || "Failed to run check cycle" });
    }
  });

  // API route to trigger or test Heartbeat health check report (60-minute check)
  app.all(["/api/heartbeat/run", "/api/heartbeat"], async (req, res) => {
    try {
      const result = await sendHeartbeatReport({ manual: true });
      res.setHeader("Content-Type", "application/json");
      res.json({
        success: result.success,
        message: "Laporan Detak Jantung Sistem berhasil diproses",
        details: result
      });
    } catch (error: any) {
      console.error("[API Error] /api/heartbeat/run:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ success: false, error: error?.message || "Gagal memproses heartbeat" });
    }
  });

  // API route to check live message gateway connection & quota (Telegram & WhatsApp Fonnte)
  app.get("/api/gateway-status", async (req, res) => {
    try {
      const status = await checkGatewayStatus();
      res.setHeader("Content-Type", "application/json");
      res.json({ success: true, gateways: status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || "Gagal memeriksa gateway" });
    }
  });

  // API route to retry failed notifications from today
  app.post("/api/auto-notify/retry", async (req, res) => {
    try {
      const result = await retryFailedNotifications();
      res.setHeader("Content-Type", "application/json");
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || "Gagal mencoba ulang notifikasi" });
    }
  });

  // API route to get notifier settings (e.g. customized WhatsApp target)
  app.get("/api/notifier-settings", (req, res) => {
    try {
      const waInfo = resolveValidWhatsAppTarget();
      const tgInfo = resolveTelegramHeartbeatTarget();
      const currentSettings = getNotifierSettings();
      res.setHeader("Content-Type", "application/json");
      res.json({
        success: true,
        settings: {
          ...currentSettings,
          whatsappTarget: currentSettings.whatsappTarget ? maskPhoneNumber(currentSettings.whatsappTarget) : undefined,
          telegramHeartbeatUser: currentSettings.telegramHeartbeatUser ? maskTelegramId(currentSettings.telegramHeartbeatUser) : undefined
        },
        resolvedWhatsAppTarget: waInfo.maskedTarget,
        maskedWhatsAppTarget: waInfo.maskedTarget,
        resolvedWhatsAppSource: waInfo.source,
        resolvedTelegramHeartbeatTarget: {
          ...tgInfo,
          chatId: tgInfo.maskedChatId || (tgInfo.chatId ? maskTelegramId(tgInfo.chatId) : null)
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API route to verify admin password for sensitive settings change
  app.post("/api/verify-admin-password", (req, res) => {
    try {
      const adminPassword = getEffectiveAdminPassword();
      const { password } = req.body || {};
      if (!password || String(password).trim() !== adminPassword) {
        return res.status(403).json({ success: false, error: "Password admin salah!" });
      }
      res.setHeader("Content-Type", "application/json");
      res.json({ success: true, message: "Password admin terverifikasi" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API route to change admin password directly from UI
  app.post("/api/change-admin-password", (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const effectivePassword = getEffectiveAdminPassword();
      if (!currentPassword || String(currentPassword).trim() !== effectivePassword) {
        return res.status(403).json({ success: false, error: "Password saat ini salah!" });
      }
      if (!newPassword || String(newPassword).trim().length < 4) {
        return res.status(400).json({ success: false, error: "Password baru minimal 4 karakter!" });
      }
      saveNotifierSettings({ adminPassword: String(newPassword).trim() });
      res.setHeader("Content-Type", "application/json");
      res.json({ success: true, message: "Password admin berhasil diganti dan disimpan!" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API route to save notifier settings (password protected for automated WhatsApp target)
  app.post("/api/notifier-settings", (req, res) => {
    try {
      const adminPassword = getEffectiveAdminPassword();
      const clientPassword = (req.body?.password || "").trim();

      // Jika mengubah nomor WhatsApp otomatis, validasi password admin
      if (req.body?.whatsappTarget !== undefined && clientPassword !== adminPassword) {
        return res.status(403).json({ 
          success: false, 
          error: "Password admin salah! Diperlukan otorisasi password admin untuk mengubah nomor WhatsApp otomatis sistem." 
        });
      }

      // Bersihkan password dari objek payload sebelum disimpan ke JSON
      const { password, ...cleanSettings } = req.body || {};
      const updated = saveNotifierSettings(cleanSettings);
      const waInfo = resolveValidWhatsAppTarget();
      const tgInfo = resolveTelegramHeartbeatTarget();
      res.setHeader("Content-Type", "application/json");
      res.json({
        success: true,
        settings: {
          ...updated,
          whatsappTarget: updated.whatsappTarget ? maskPhoneNumber(updated.whatsappTarget) : undefined,
          telegramHeartbeatUser: updated.telegramHeartbeatUser ? maskTelegramId(updated.telegramHeartbeatUser) : undefined
        },
        resolvedWhatsAppTarget: waInfo.maskedTarget,
        maskedWhatsAppTarget: waInfo.maskedTarget,
        resolvedWhatsAppSource: waInfo.source,
        resolvedTelegramHeartbeatTarget: {
          ...tgInfo,
          chatId: tgInfo.maskedChatId || (tgInfo.chatId ? maskTelegramId(tgInfo.chatId) : null)
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API route to proxy NASA FIRMS
  app.get("/api/hotspots", async (req, res) => {
    try {
      const apiKey = process.env.NASA_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "NASA_API_KEY is not configured on the server." });
      }

      // Read days parameter: support 1, 2, 7, 30 (default: 1)
      let days = parseInt(req.query.days as string, 10);
      if (![1, 2, 7, 30].includes(days)) {
        days = 1;
      }

      // Check cache
      const cached = firmsCache.get(days);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        res.header('Content-Type', 'text/csv');
        return res.send(cached.data);
      }
      
      
      // Area bounding box covers Kelanis Port (114.85°E, -2.26°S) up to Mine Concessions (115.65°E, -2.05°S)
      const bbox = "114.85,-2.35,115.65,-2.05";
      const sources = ["VIIRS_SNPP_NRT", "MODIS_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "LANDSAT_NRT"];
      
      let header = "";
      const seen = new Set();
      const rows = [];

      if (days === 1) {
        const results = await Promise.all(sources.map(async (source) => {
          const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/1`;
          try {
            const r = await fetch(url);
            if (!r.ok) return "";
            return await r.text();
          } catch (e) {
            return "";
          }
        }));

        for (const text of results) {
          const lines = text.trim().split("\n");
          if (lines.length === 0) continue;
          if (!header && lines[0] && lines[0].includes("latitude")) {
            header = lines[0];
          }
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("latitude")) continue;
            // Generate a unique key for the hotspot based on lat/lng/time to deduplicate across sources
            const cols = line.split(",");
            const uniqueKey = `${cols[0]}-${cols[1]}-${cols[5]}-${cols[6]}`;
            if (!seen.has(uniqueKey)) {
              seen.add(uniqueKey);
              rows.push(line);
            }
          }
        }
      } else {
        const chunks = getFirmsChunks(days);
        const results = await Promise.all(chunks.flatMap(c => 
          sources.map(async (source) => {
            const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/${c.range}/${c.date}`;
            try {
              const r = await fetch(url);
              if (!r.ok) return "";
              return await r.text();
            } catch (e) {
              return "";
            }
          })
        ));

        for (const text of results) {
          const lines = text.trim().split("\n");
          if (lines.length === 0) continue;
          if (!header && lines[0] && lines[0].includes("latitude")) {
            header = lines[0];
          }
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("latitude")) continue;
            const cols = line.split(",");
            const uniqueKey = `${cols[0]}-${cols[1]}-${cols[5]}-${cols[6]}`;
            if (!seen.has(uniqueKey)) {
              seen.add(uniqueKey);
              rows.push(line);
            }
          }
        }
      }

      const csvCombined = [header, ...rows].join("\n");
      firmsCache.set(days, { data: csvCombined, timestamp: Date.now() });
      res.header('Content-Type', 'text/csv');
      res.send(csvCombined);
    } catch (error) {
      console.error("Error fetching NASA hotspots:", error);
      res.status(500).json({ error: "Failed to fetch hotspots" });
    }
  });

  // API route for ultra-fast Reverse Geocoding with In-Memory Cache and ArcGIS + OSM
  app.get("/api/geocode", async (req, res) => {
    try {
      const latNum = parseFloat(req.query.lat as string);
      const lngNum = parseFloat(req.query.lng as string);
      
      if (isNaN(latNum) || isNaN(lngNum)) {
        return res.status(400).json({ error: "Missing or invalid lat or lng" });
      }

      // Cache key rounded to 4 decimals (~11 meter precision, perfect for hotspots)
      const cacheKey = `${latNum.toFixed(4)},${lngNum.toFixed(4)}`;
      if (geocodeServerCache.has(cacheKey)) {
        return res.json(geocodeServerCache.get(cacheKey));
      }

      // 1. Primary engine: ArcGIS World Reverse Geocode (fast, no rate limits, accurate administrative fields)
      try {
        const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lngNum},${latNum}&f=json`;
        const arcgisRes = await fetch(arcgisUrl, { signal: AbortSignal.timeout(3500) });
        if (arcgisRes.ok) {
          const arcgisData = await arcgisRes.json();
          if (arcgisData && arcgisData.address) {
            const addr = arcgisData.address;
            const ds = addr.Neighborhood || addr.District || addr.PlaceName || addr.ShortLabel || "";
            const kec = addr.City || "";
            const kab = addr.Subregion || addr.MetroArea || "";
            const prov = addr.Region || "";

            const parts: string[] = [];
            if (ds) {
              if (ds.toLowerCase().includes("desa") || ds.toLowerCase().includes("kelurahan")) {
                parts.push(ds);
              } else {
                parts.push(`Desa ${ds}`);
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

            const displayName = parts.length > 0 ? parts.join(", ") : (addr.Match_addr || "Detail lokasi tidak tersedia");

            const formatted = {
              display_name: displayName,
              address: {
                village: ds,
                city_district: kec,
                county: kab,
                state: prov,
              }
            };

            geocodeServerCache.set(cacheKey, formatted);
            return res.json(formatted);
          }
        }
      } catch (arcgisErr) {
        // Fallback to OSM
      }

      // 2. Fallback engine: OpenStreetMap Nominatim
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&accept-language=id&email=namasayasutejo@gmail.com`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "AdaroHotspotMonitor/1.0 (namasayasutejo@gmail.com)"
          },
          signal: AbortSignal.timeout(3500)
        });
        
        if (response.ok) {
          const data = await response.json();
          geocodeServerCache.set(cacheKey, data);
          return res.json(data);
        }
      } catch (osmErr) {
        // Continue to fallback response
      }

      res.status(404).json({ error: "Detail lokasi tidak tersedia" });
    } catch (error) {
      console.error("Error fetching geocoding:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API route to proxy ESDM ArcGIS REST API
  app.get("/api/iupk", async (req, res) => {
    try {
      // Target ArcGIS query endpoint on Geoportal ESDM
      const baseUrl = req.query.url || "https://geoportal.esdm.go.id/gis1/rest/services/Join_WIUP_vs_IPPKH/MapServer/0/query";
      
      const arcgisUrl = new URL(baseUrl as string);
      
      // Support flexible filter: default matches IUPK Adaro Indonesia in South Kalimantan
      let whereFilter = (req.query.where as string) || "UPPER(nama_usaha) LIKE '%ADARO INDONESIA%' OR UPPER(badan_usah) LIKE '%ADARO INDONESIA%'";
      if (req.query.where && (req.query.where as string).includes("NAMA_PERUSAHAAN")) {
        // Adapt NAMA_PERUSAHAAN parameter to actual field nama_usaha
        whereFilter = (req.query.where as string).replace(/NAMA_PERUSAHAAN/g, "nama_usaha");
      }

      arcgisUrl.searchParams.append("where", whereFilter);
      arcgisUrl.searchParams.append("outFields", "*");
      arcgisUrl.searchParams.append("f", "geojson");
      arcgisUrl.searchParams.append("returnGeometry", "true");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(arcgisUrl.toString(), {
        headers: { 'Accept': 'application/json, text/plain' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const rawText = await response.text();

      // Ensure response is not an HTML error/login page
      if (rawText.trim().startsWith("<")) {
        console.warn("ArcGIS API returned HTML instead of JSON. Serving fallback.");
        return res.status(502).json({ error: "ArcGIS API returned HTML page" });
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        return res.status(502).json({ error: "Invalid JSON response from ArcGIS server" });
      }

      if (data && data.error) {
        return res.status(400).json({ error: data.error.message || "ArcGIS query error" });
      }

      res.json(data);
    } catch (error: any) {
      console.warn("Notice while fetching IUPK data via ArcGIS API:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch IUPK data" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Start 24/7 background hotspot monitor (Interval Standar: 15 menit)
    startAutoNotifier(15);
    // Start 60-minute periodic heartbeat & gateway quota monitor
    startHeartbeatDaemon(60);
  });

  // Graceful shutdown on SIGTERM / SIGINT to prevent corrupted state
  const gracefulShutdown = (signal: string) => {
    console.log(`[Process Guard] Menerima sinyal ${signal}. Menutup server & membersihkan timer...`);
    stopAutoNotifier();
    stopHeartbeatDaemon();
    server.close(() => {
      console.log("[Process Guard] HTTP server ditutup dengan aman.");
      process.exit(0);
    });
    // Force exit if hanging after 5s
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer();
