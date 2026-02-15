import { GoogleGenAI } from "@google/genai";
import { StoryConfig, POI, Location } from "../types";

// Note: The API Key must be provided via process.env.API_KEY
// The user of this generated code is responsible for setting this environment variable.

export const generateStoryStream = async (
  start: Location,
  end: Location,
  pois: POI[],
  config: StoryConfig
) => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";

  const poiNames = pois.map(p => p.name).join(', ');

  const prompt = `
    Tu es un conteur expert.
    Génère une histoire courte et immersive (max 400 mots) basée sur un voyage réel.
    
    PARAMÈTRES:
    - Départ: ${start.name}
    - Arrivée: ${end.name}
    - Lieux visités (Points d'intérêts): ${poiNames || "quelques lieux mystérieux"}
    - Style: ${config.style}
    - Langue: ${config.language === 'Auto' ? 'Français' : config.language}
    
    INSTRUCTIONS:
    Intègre les points d'intérêts naturellement dans l'histoire.
    Utilise le style demandé pour donner le ton (ex: si Fantastique, transforme le trajet en quête épique).
    Sois créatif mais garde une cohérence géographique.
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: model,
      contents: prompt,
    });
    return response;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};