// Netlify Serverless Function for Reverse Geocoding
// Replicates /api/geocode in serverless Netlify environment

interface HandlerEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined>;
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

  try {
    const latStr = event.queryStringParameters?.lat;
    const lngStr = event.queryStringParameters?.lng;

    if (!latStr || !lngStr) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: "Missing lat or lng" }) 
      };
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    // ==============================================================================
    // USE ARCGIS GEOCODE SERVER
    // Provides much better administrative boundaries for Indonesia compared to OSM 
    // which often tags large industrial mining areas as localities.
    // ==============================================================================
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "PantauBumiHotspotMonitor/1.0"
      }
    });

    if (!response.ok) {
      return { 
        statusCode: response.status, 
        headers, 
        body: JSON.stringify({ error: "Failed to fetch from ArcGIS Geocoder" }) 
      };
    }

    const data = await response.json();
    
    let mappedData: any = { address: {} };
    if (data && data.address) {
      mappedData.address = {
        village: data.address.Neighborhood || data.address.PlaceName,
        city_district: data.address.City || data.address.District,
        county: data.address.Subregion || data.address.MetroArea,
        state: data.address.Region,
        country: data.address.CntryName
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mappedData)
    };
  } catch (error) {
    console.error("Error fetching geocoding:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
