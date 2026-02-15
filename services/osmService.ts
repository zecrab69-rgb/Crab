import axios from 'axios';
import { NominatimResult, POI } from '../types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

export const searchLocation = async (query: string): Promise<NominatimResult[]> => {
  try {
    const response = await axios.get<NominatimResult[]>(NOMINATIM_BASE_URL, {
      params: {
        q: query,
        format: 'json',
        limit: 5,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'TravelTale-OSM-App/1.0',
      },
    });
    return response.data;
  } catch (error) {
    console.error("Nominatim Search Error:", error);
    return [];
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon: lng,
        format: 'json',
      },
      headers: {
        'User-Agent': 'TravelTale-OSM-App/1.0',
      },
    });
    return response.data.display_name.split(',')[0]; // Return the first part of the address (usually city/poi)
  } catch (error) {
    console.error("Reverse Geocode Error:", error);
    return "Lieu inconnu";
  }
};

export const getPOIs = async (lat: number, lng: number, radius: number = 2000): Promise<POI[]> => {
  // Overpass QL query: Search for tourism and historic nodes around the point
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"~"museum|attraction|artwork|viewpoint"](around:${radius},${lat},${lng});
      node["historic"~"castle|ruins|memorial|monument"](around:${radius},${lat},${lng});
    );
    out body 15;
    >;
    out skel qt;
  `;

  try {
    const response = await axios.post(OVERPASS_API_URL, `data=${encodeURIComponent(query)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;
    if (!data || !data.elements) return [];

    // Map Overpass elements to our POI interface
    return data.elements.map((el: any) => {
        const tags = el.tags || {};
        
        // Construct address from tags
        const address = [
            tags['addr:housenumber'],
            tags['addr:street'],
            tags['addr:postcode'],
            tags['addr:city']
        ].filter(Boolean).join(', ');

        return {
            id: el.id,
            lat: el.lat,
            lng: el.lon,
            name: tags.name || tags.description || "Lieu d'intérêt sans nom",
            type: tags.tourism || tags.historic || "poi",
            website: tags.website || tags.url,
            description: tags.description || tags.note || tags['description:fr'] || tags['description:en'],
            address: address || undefined,
        };
    }).filter((poi: POI) => poi.name !== "Lieu d'intérêt sans nom");
  } catch (error) {
    console.error("Overpass API Error:", error);
    return [];
  }
};