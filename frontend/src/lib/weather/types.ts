// 11-tier locked spec. Precipitation tiers carry their intensity in the name
// (light/moderate/heavy) so visual tiers map 1:1 with WMO+visibility — no
// secondary intensity lookup needed. Single source of truth: any consumer
// extending the tier set must add a case to every `switch (tier)` (each
// guarded by an exhaustive `never`-typed default), so TS catches drift.
export type WeatherCondition =
  | 'sunny'
  | 'partly-cloudy'
  | 'overcast'
  | 'foggy'
  | 'light-rain'
  | 'moderate-rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'light-snow'
  | 'moderate-snow'
  | 'heavy-snow';

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

// Back-compat alias for 2A/2C visual components plus a dev-cycler input
// vocabulary. 'partly_cloudy', 'overcast', and the three snow tiers are
// NOT produced by the real pipeline — `deriveAtmosphereCondition` still
// maps overcast/partly-cloudy/snow tiers to existing values for back-compat.
// They exist so the dev cycler can synthesize each tier explicitly via
// hourlyFromMock. 'cloudy' is the runtime back-compat value; 'overcast' is
// the cycler-only equivalent that produces the same conditionTier.
export type AtmosphereCondition =
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'overcast'
  | 'foggy'
  | 'light_rain'
  | 'moderate_rain'
  | 'heavy_rain'
  | 'thunderstorm'
  | 'light_snow'
  | 'moderate_snow'
  | 'heavy_snow';

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
  // True when windSpeedMps >= 7 at sample time. Consumed by visual layers
  // for turbulence effects; not blended across hours (discrete).
  windy: boolean;
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
