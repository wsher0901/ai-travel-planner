// New 6-tier union — adds 'sunny' (replaces 2A's 'clear') and 'snow'.
// 2A's `ConditionTier` was a 5-value subset; this is the canonical type going forward.
export type WeatherCondition =
  | 'sunny'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow';

export type PrecipitationIntensity = 'none' | 'light' | 'moderate' | 'heavy';

export type SunMood = 'normal' | 'warm' | 'muted' | 'hidden';

export interface HourlyWeather {
  hour: number; // 0..23
  weatherCode: number;
  precipitationMmHr: number;
  snowfallCmHr: number;
  cloudCover: number;
  cloudCoverLow: number;
  cloudCoverMid: number;
  cloudCoverHigh: number;
  windSpeedMps: number;   // backend-converted from km/h
  windAngleDeg: number;   // backend-converted FROM-direction → TO-direction
  visibilityM: number;
  humidity: number;
  apparentTempC: number;
  uvIndex: number;
  // Air-quality fields are best-effort. Null when upstream air-quality API
  // failed (e.g., trip start more than ~5 days out — beyond AQI horizon).
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
}

export interface DayMeta {
  sunrise: Date;
  sunset: Date;
  maxTempC: number;
  minTempC: number;
}

export interface DayWeather {
  date: string; // YYYY-MM-DD
  hourly: HourlyWeather[];
  daily: DayMeta;
}

// Back-compat alias for 2A/2C visual components that look up tier-spec maps
// keyed by a fine-grained condition (e.g. RainField uses 'light_rain' to
// pick particle counts). 3B will replace these lookups with continuous
// precipitationIntensity + tier — until then, we derive this from
// (conditionTier, precipitationIntensity) in atmosphere.ts.
export type AtmosphereCondition =
  | 'sunny'
  | 'cloudy'
  | 'foggy'
  | 'light_rain'
  | 'moderate_rain'
  | 'heavy_rain'
  | 'thunderstorm';

// Extended SceneAtmosphere — strict superset of 2A. New fields:
// precipitationIntensity, fogDensityMultiplier; conditionTier widens to
// include 'snow'. `condition` retained for 2A/2C back-compat.
export interface SceneAtmosphere {
  tint: { r: number; g: number; b: number; a: number };
  dimming: number;
  sunVisible: boolean;
  sunMood: SunMood;
  goldenHourActive: boolean;
  windVector: { angleDeg: number; speedMps: number };
  conditionTier: WeatherCondition;
  precipitationIntensity: PrecipitationIntensity;
  intensity: number;
  fogDensityMultiplier: number;
  // Back-compat for 2A/2C — derived, not authoritative.
  condition: AtmosphereCondition;
}

// Backend wire format. Hourly is identical; daily.sunrise/sunset arrive as
// ISO strings on the wire and become Date once parsed by the hook.
export interface DayWeatherWire {
  date: string;
  hourly: HourlyWeather[];
  daily: {
    sunrise: string;
    sunset: string;
    maxTempC: number;
    minTempC: number;
  };
}

// Where the day data came from. 'forecast' = real Open-Meteo forecast
// (within 16-day horizon). 'estimate' = climate model + historical archive
// blend, used when the trip is beyond forecast horizon. 'unavailable' =
// both climate and historical APIs failed; days[] is empty and the
// frontend synthesizes a mock fallback.
export type WeatherSource = 'forecast' | 'estimate' | 'unavailable';

export interface WeatherResponseWire {
  days: DayWeatherWire[];
  fetchedAt: number; // unix seconds
  source: WeatherSource;
  // Only present when source === 'unavailable' — mirrors the backend's
  // signal that the trip is beyond forecast horizon AND estimate failed.
  outOfRange?: boolean;
}
