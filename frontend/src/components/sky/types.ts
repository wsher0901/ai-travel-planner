import type { SeasonalPalette } from '@/lib/sunPosition';

export type { SeasonalPalette };

export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'rain-light'
  | 'rain-heavy'
  | 'thunderstorm'
  | 'snow-light'
  | 'snow-heavy';

export interface WeatherSegment {
  startHour: number;   // 0-24 fractional
  endHour: number;     // 0-24 fractional
  wmoCode: number;     // WMO weather code (Open-Meteo standard)
  tempC: number;
  precipMm: number;
  cloudCover: number;  // 0-100
}

export type SceneryPreset = 'cityscape' | 'beachscape' | 'mountainscape' | 'desertscape' | 'forestscape';

export interface SkyStripProps {
  date: string;
  lat: number;
  lng: number;
  timezone?: string;
  scenery?: SceneryPreset;
  weatherSegments?: WeatherSegment[];
  palette?: SeasonalPalette;
  isToday?: boolean;
  aspectScale?: number;
}
