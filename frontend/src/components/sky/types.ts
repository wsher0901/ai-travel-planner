import type { SeasonalPalette } from '@/lib/sunPosition';

export type { SeasonalPalette };

export type WeatherCondition =
  | 'sunny' | 'cloudy' | 'rain-light' | 'rain-heavy'
  | 'snow' | 'thunderstorm' | 'fog';

export interface WeatherSegment {
  startHour: number;
  endHour: number;
  condition: WeatherCondition;
}

export type SceneryPreset = 'cityscape' | 'oceanscape' | 'mountainscape' | 'plains';

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
