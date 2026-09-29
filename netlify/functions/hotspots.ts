// Netlify Serverless Function for NASA FIRMS Hotspots
// Replicates /api/hotspots in serverless Netlify environment

interface HandlerEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string | boolean | number>;
  body: string;
}

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

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "NASA_API_KEY is not configured on the server." }),
      };
    }

    let days = parseInt(event.queryStringParameters?.days || "1", 10);
    if (![1, 2, 7, 30].includes(days)) {
      days = 1;
    }

    const bbox = "114.85,-2.35,115.65,-2.05";
    const sources = ["VIIRS_SNPP_NRT", "MODIS_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"];

    let header = "";
    const seen = new Set<string>();
    const rows: string[] = [];

    if (days === 1) {
      const results = await Promise.all(
        sources.map(async (source) => {
          const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/1`;
          try {
            const r = await fetch(url);
            if (!r.ok) return "";
            return await r.text();
          } catch {
            return "";
          }
        })
      );

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
    } else {
      const chunks = getFirmsChunks(days);
      const results = await Promise.all(
        chunks.flatMap((c) =>
          sources.map(async (source) => {
            const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bbox}/${c.range}/${c.date}`;
            try {
              const r = await fetch(url);
              if (!r.ok) return "";
              return await r.text();
            } catch {
              return "";
            }
          })
        )
      );

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

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
      body: csvCombined,
    };
  } catch (error: any) {
    console.error("Error in Netlify function hotspots:", error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to fetch hotspots" }),
    };
  }
};
