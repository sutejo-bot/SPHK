// Netlify Serverless Function for Telegram Notifications
// Replicates /api/notify-telegram in serverless Netlify environment

interface HandlerEvent {
  httpMethod: string;
  body: string | null;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string | boolean | number>;
  body: string;
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing body" }) };
    }

    const { lat, lng, location, date, id, source, confidence, zone } = JSON.parse(event.body);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: "Token atau Chat ID Telegram belum dikonfigurasi. Harap tambahkan 'TELEGRAM_BOT_TOKEN' dan 'TELEGRAM_CHAT_ID' pada menu Environment Variables di pengaturan Netlify Anda." }) 
      };
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

    const pesan = `${header}\n\n` +
      `🔥 *ID Hotspot*: \`${id}\`\n` +
      `📍 *Koordinat*: \`${lat}, ${lng}\`\n` +
      `🗺️ *Lokasi*: ${location || 'Sedang dimuat...'}\n` +
      `🕒 *Waktu Satelit*: ${date}${confText}\n` +
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
      return { statusCode: response.status, headers, body: JSON.stringify({ error: errText }) };
    }

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (error: any) {
    console.error("Error sending Telegram:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Failed to send Telegram message" })
    };
  }
};
