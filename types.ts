export interface Location {
  lat: number;
  lng: number;
  name: string;
}

export interface POI {
  id: number;
  lat: number;
  lng: number;
  name: string;
  type: string;
  website?: string;
  description?: string;
  address?: string;
}

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
}

export enum StoryStyle {
  HISTORICAL = 'Historique',
  FANTASY = 'Fantaisie',
  ADVENTURE = 'Aventure',
  CHILDREN = 'Enfant',
  SCIFI = 'Science-Fiction',
}

export enum StoryLanguage {
  AUTO = 'Auto',
  FRENCH = 'Français',
  ENGLISH = 'English',
  SPANISH = 'Español',
  GERMAN = 'Deutsch',
}

export interface StoryConfig {
  style: StoryStyle;
  language: StoryLanguage;
}

export type TransportMode = 'car' | 'bike' | 'foot';
