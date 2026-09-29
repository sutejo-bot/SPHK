// Netlify Scheduled Function for background hotspot monitoring (cron: */10 * * * *)
import fs from "fs";
import { checkHotspotZone, identifyHotspotSource } from "../../src/data";
import { findNearestLocalVillage } from "../../src/villageData";

interface HandlerEvent {
  httpMethod?: string;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string | boolean | number>;
  body: string;
}

const STORAGE_FILE = "/tmp/notified_hotspots.json";

function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat1 - lat2) * 111.0;
  const dLng = (lng1 - lng2) * 110.9;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function findExistingRecentCluster(
  lat: number,
  lng: number,
  detectedAt: Date,
  storage: { hotspots: Record<string, any> },
  radiusKm = 1.5,
  windowHours = 24
): any | null {
  const candidateTime = detectedAt.getTime();

  for (const item of Object.values(storage.hotspots)) {
    const itemTime = new Date(item.detectedAt || item.notifiedAt).getTime();
    const diffHours = Math.abs(candidateTime - itemTime) / (1000 * 60 * 60);

    if (diffHours <= windowHours) {
      const dist = calculateDistanceKm(lat, lng, item.lat, item.lng);
      if (dist <= radiusKm) {
        return item;
      }
    }
  }

  return null;
}

function getStorage() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
    }
  } catch {}
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunTime: null,
    lastCheckStatus: "Belum berjalan",
    hotspots: {}
  };
}

function saveStorage(data: any) {
  try {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

function formatWITA(dateObj: Date): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
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

async function sendTelegramAlert(hotspot: {
  id: string;
  lat: number;
  lng: number;
  location: string;
  date: string;
  zone: string;
  confidence: number;
  source?: string;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const zoneLabel =
    hotspot.zone === "iupk"
      ? "Konsesi IUPK (Area Inti Operasi)"
      : "Buffer Zone (Koridor Penunjang)";

  const sourceName = hotspot.source || "Multi-Satelit Terintegrasi (Jepang / BRIN / SiPongi / BMKG)";

  const pesan =
    `🚨 *PERINGATAN DINI KARHUTLA - DETEKSI OTOMATIS* 🚨\n\n` +
    `Sistem mendeteksi adanya anomali termal / titik api baru di area operasional:\n\n` +
    `🔥 *ID Hotspot*: \`${hotspot.id}\`\n` +
    `🕒 *Waktu Satelit (NASA)*: ${hotspot.date}\n` +
    `🛰️ *Sumber Satelit*: ${sourceName}\n` +
    `📍 *Koordinat*: \`${hotspot.lat}, ${hotspot.lng}\`\n` +
    `🗺️ *Lokasi*: ${hotspot.location}\n` +
    `🎯 *Keyakinan*: ${hotspot.confidence}%\n` +
    `🛡️ *Kategori Wilayah*: ${zoneLabel}\n\n` +
    `🤖 *Status*: Notifikasi otomatis 24/7 (Anti-Tumpang Tindih 1.5 km / 24 Jam Aktif).\n` +
    `⚠️ *Perhatian Petugas*: Segera hubungi posko satgas terdekat untuk pengecekan darat!\n\n` +
    `📍 *Buka Titik di Google Maps:*\n` +
    `https://maps.google.com/?q=${hotspot.lat},${hotspot.lng}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: pesan,
        parse_mode: "Markdown"
      }),
      signal: AbortSignal.timeout(6000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "NASA_API_KEY is not configured" })
    };
  }

  try {
    const bbox = "114.85,-2.35,115.65,-2.05";
    const sources = ["VIIRS_SNPP_NRT", "MODIS_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "LANDSAT_NRT"];

    const csvResults = await Promise.all(
      sources.map(async (src) => {
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${src}/${bbox}/1`;
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) return "";
          return await res.text();
        } catch {
          return "";
        }
      })
    );

    const candidates: Array<{
      id: string;
      lat: number;
      lng: number;
      zone: string;
      confidence: number;
      detectedAt: Date;
      source: string;
    }> = [];

    const seenIds = new Set<string>();

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

        const acqDate = cols[5] || "";
        const acqTime = cols[6] || "";

        let detectedAt = new Date();
        if (acqDate) {
          const parts = acqDate.split("-").map(Number);
          const hours = acqTime ? acqTime.padStart(4, "0").substring(0, 2) : "00";
          const mins = acqTime ? acqTime.padStart(4, "0").substring(2, 4) : "00";
          detectedAt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parseInt(hours, 10), parseInt(mins, 10)));
        }

        // Deterministic ID based on NASA timestamp: Hari, Tanggal, dan Jam (WITA)
        const baseId = generateHotspotIdFromNasa(acqDate, acqTime);
        let id = baseId;
        let counter = 1;
        while (seenIds.has(id)) {
          counter++;
          id = `${baseId}-${counter}`;
        }

        const satInfo = identifyHotspotSource(cols[7] || "", cols[8] || "");

        if (!seenIds.has(id)) {
          seenIds.add(id);
          candidates.push({ id, lat, lng, zone, confidence, detectedAt, source: satInfo.source });
        }
      }
    }

    const storage = getStorage();
    const isFirstRun = Object.keys(storage.hotspots).length === 0;

    if (isFirstRun) {
      for (const c of candidates) {
        const loc = findNearestLocalVillage(c.lat, c.lng) || "Wilayah Operasional";
        storage.hotspots[c.id] = {
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          detectedAt: c.detectedAt.toISOString(),
          notifiedAt: new Date().toISOString(),
          location: loc,
          zone: c.zone,
          source: c.source,
          status: "initial_baseline"
        };
      }
      storage.lastRunTime = new Date().toISOString();
      storage.lastCheckStatus = `Inisialisasi berhasil: ${candidates.length} hotspot tercatat sebagai baseline aman.`;
      saveStorage(storage);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: "ok",
          mode: "baseline_initialized",
          checkedAt: storage.lastRunTime,
          totalDetectedInZone: candidates.length
        })
      };
    }

    // SPATIAL-TEMPORAL DEDUPLICATION (1.5 KM & 24 Jam):
    const genuineNewHotspots: typeof candidates = [];

    for (const candidate of candidates) {
      if (storage.hotspots[candidate.id]) continue;

      const existingCluster = findExistingRecentCluster(
        candidate.lat,
        candidate.lng,
        candidate.detectedAt,
        storage,
        1.5,
        24
      );

      if (existingCluster) {
        storage.hotspots[candidate.id] = {
          id: candidate.id,
          lat: candidate.lat,
          lng: candidate.lng,
          detectedAt: candidate.detectedAt.toISOString(),
          notifiedAt: new Date().toISOString(),
          location: existingCluster.location || "Wilayah Operasional",
          zone: candidate.zone,
          source: candidate.source,
          clusterWith: existingCluster.id,
          status: "cluster_duplicate"
        };
        continue;
      }

      genuineNewHotspots.push(candidate);
    }

    const notifiedIds: string[] = [];
    const alertsToSend = genuineNewHotspots.slice(0, 5);

    for (const h of alertsToSend) {
      const locationName = findNearestLocalVillage(h.lat, h.lng) || "Wilayah Operasional";
      const formattedDate = formatWITA(h.detectedAt);
      const tgSent = await sendTelegramAlert({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        location: locationName,
        date: formattedDate,
        zone: h.zone,
        confidence: h.confidence,
        source: h.source
      });
      storage.hotspots[h.id] = {
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        detectedAt: h.detectedAt.toISOString(),
        notifiedAt: new Date().toISOString(),
        location: locationName,
        zone: h.zone,
        source: h.source,
        status: "notified"
      };
      if (tgSent) notifiedIds.push(h.id);
    }

    for (let i = 5; i < genuineNewHotspots.length; i++) {
      const h = genuineNewHotspots[i];
      storage.hotspots[h.id] = {
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        detectedAt: h.detectedAt.toISOString(),
        notifiedAt: new Date().toISOString(),
        location: "Wilayah Operasional",
        zone: h.zone,
        source: h.source,
        status: "notified"
      };
    }

    storage.lastRunTime = new Date().toISOString();
    storage.lastCheckStatus =
      genuineNewHotspots.length > 0
        ? `Sukses: ${genuineNewHotspots.length} hotspot baru terdeteksi dan notifikasi dikirim.`
        : `Pemeriksaan selesai: Tidak ada titik api baru (${candidates.length} terpantau aman).`;
    saveStorage(storage);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "ok",
        checkedAt: storage.lastRunTime,
        totalDetectedInZone: candidates.length,
        newHotspots: genuineNewHotspots.length,
        notified: notifiedIds
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Failed check" })
    };
  }
};
