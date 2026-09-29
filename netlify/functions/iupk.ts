// Netlify Serverless Function for ESDM ArcGIS IUPK Boundary Proxy
// Replicates /api/iupk in serverless Netlify environment

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
    const baseUrl =
      event.queryStringParameters?.url ||
      "https://geoportal.esdm.go.id/gis1/rest/services/Join_WIUP_vs_IPPKH/MapServer/0/query";

    const arcgisUrl = new URL(baseUrl);

    let whereFilter =
      event.queryStringParameters?.where ||
      "UPPER(nama_usaha) LIKE '%ADARO INDONESIA%' OR UPPER(badan_usah) LIKE '%ADARO INDONESIA%'";

    if (event.queryStringParameters?.where && event.queryStringParameters.where.includes("NAMA_PERUSAHAAN")) {
      whereFilter = event.queryStringParameters.where.replace(/NAMA_PERUSAHAAN/g, "nama_usaha");
    }

    arcgisUrl.searchParams.append("where", whereFilter);
    arcgisUrl.searchParams.append("outFields", "*");
    arcgisUrl.searchParams.append("f", "geojson");
    arcgisUrl.searchParams.append("returnGeometry", "true");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(arcgisUrl.toString(), {
      headers: { Accept: "application/json, text/plain" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const rawText = await response.text();

    if (rawText.trim().startsWith("<")) {
      return {
        statusCode: 502,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "ArcGIS API returned HTML page" }),
      };
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        statusCode: 502,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Invalid JSON response from ArcGIS server" }),
      };
    }

    if (data && data.error) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: data.error.message || "ArcGIS query error" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
      body: JSON.stringify(data),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: error?.message || "Failed to fetch IUPK data" }),
    };
  }
};
