// Netlify Function for auto-notify status
import fs from "fs";

interface HandlerEvent {
  httpMethod: string;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string | boolean | number>;
  body: string;
}

const STORAGE_FILE = "/tmp/notified_hotspots.json";

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
    lastCheckStatus: "Menunggu pemeriksaan pertama",
    hotspots: {}
  };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  const storage = getStorage();
  const allList = Object.values(storage.hotspots || {}) as any[];
  allList.sort((a, b) => new Date(b.notifiedAt).getTime() - new Date(a.notifiedAt).getTime());

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      enabled: true,
      mode: "serverless_scheduled",
      intervalMinutes: 10,
      lastRunTime: storage.lastRunTime || null,
      lastCheckStatus: storage.lastCheckStatus || "Siap melakukan pengecekan",
      newHotspotsDetectedLastRun: 0,
      totalTrackedHotspots: allList.length,
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      whatsappConfigured: Boolean(process.env.FONNTE_TOKEN),
      recentNotifications: allList.slice(0, 15),
      message: "Monitoring otomatis aktif di Netlify (Scheduled Functions & Webhook)."
    })
  };
};
