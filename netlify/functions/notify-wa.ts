// Netlify Serverless Function for Fonnte WhatsApp Notifications
// Replicates /api/notify-wa in serverless Netlify environment

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

    const { target, lat, lng, location, date, id, source, confidence, zone } = JSON.parse(event.body);
    const token = process.env.FONNTE_TOKEN;
    
    if (!token) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: "Token Fonnte belum dikonfigurasi. Harap tambahkan 'FONNTE_TOKEN' pada menu Environment Variables di pengaturan Netlify Anda." }) 
      };
    }

    const isAuto = source === 'auto';
    const header = isAuto 
      ? `🚨 *DARURAT KARHUTLA - DETEKSI OTOMATIS* 🚨` 
      : `🚨 *DARURAT KARHUTLA - PENGIRIMAN MANUAL* 🚨`;

    const statusText = isAuto
      ? `🤖 *Status*: Notifikasi ini dikirim secara otomatis.`
      : `👤 *Status*: Notifikasi ini dikirim secara manual oleh operator.`;

    const zoneText = zone === 'iupk' 
      ? 'Konsesi IUPK (Area Inti Operasi)' 
      : (zone === 'buffer' ? 'Buffer Zone (Koridor Penunjang)' : 'Sekitar Wilayah Operasional');

    const pesan = `${header}\n\n` +
      `🔥 *ID*: ${id}\n` +
      `📍 *Koordinat*: ${lat}, ${lng}\n` +
      `🗺️ *Lokasi*: ${location || 'Sedang dimuat...'}\n` +
      `🕒 *Waktu*: ${date}\n` +
      `🛡️ *Zona*: ${zoneText}\n\n` +
      `${statusText}\n` +
      `Segera lakukan pengecekan ke lokasi!\n\n` +
      `📍 *Buka Peta:*\nhttps://maps.google.com/?q=${lat},${lng}`;

    const formData = new URLSearchParams();
    formData.append('target', target);
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
      return { statusCode: response.status, headers, body: JSON.stringify({ error: errText }) };
    }

    const data = await response.json();
    
    // Fonnte sometimes returns HTTP 200 but status inside JSON is false
    if (data.status === false) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: data.reason || "Fonnte API rejected the request." }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (error: any) {
    console.error("Error sending WA:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Failed to send WhatsApp message" })
    };
  }
};
