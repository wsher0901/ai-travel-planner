import type {
  AtmosphereCondition,
  HourlyWeather,
  PrecipitationIntensity,
  WeatherCondition,
} from './types';

// Open-Meteo WMO weather_code → conditionTier with two overrides:
//   1. visibility < 4000 m promotes anything to 'foggy'
//   2. cloudCover promotes WMO 0/1 to 'partly-cloudy' (≥60) and WMO 2 to
//      'overcast' (≥80) — code resolution alone is too coarse for high-cloud
//      conditions that don't trigger code 3.
// Reference: https://open-meteo.com/en/docs (weather_code section)
export function mapToConditionTier(h: HourlyWeather): WeatherCondition {
  // Visibility-driven fog override — heavy fog can occur with code 0/1.
  if (h.visibilityM < 4000) return 'foggy';

  const code = h.weatherCode;

  // Cloud-cover family with promotion.
  if (code === 0 || code === 1) return h.cloudCover < 60 ? 'sunny' : 'partly-cloudy';
  if (code === 2) return h.cloudCover < 80 ? 'partly-cloudy' : 'overcast';
  if (code === 3) return 'overcast';

  // Fog / depositing rime fog.
  if (code === 45 || code === 48) return 'foggy';

  // Drizzle 51/53/55, freezing drizzle 56/57.
  if (code === 51 || code === 56) return 'light-rain';
  if (code === 53 || code === 57) return 'moderate-rain';
  if (code === 55) return 'heavy-rain';

  // Rain 61/63/65, freezing rain 66/67.
  if (code === 61 || code === 66) return 'light-rain';
  if (code === 63) return 'moderate-rain';
  if (code === 65 || code === 67) return 'heavy-rain';

  // Snowfall 71/73/75, snow grains 77.
  if (code === 71 || code === 77) return 'light-snow';
  if (code === 73) return 'moderate-snow';
  if (code === 75) return 'heavy-snow';

  // Rain showers 80/81/82.
  if (code === 80) return 'light-rain';
  if (code === 81) return 'moderate-rain';
  if (code === 82) return 'heavy-rain';

  // Snow showers 85/86.
  if (code === 85) return 'light-snow';
  if (code === 86) return 'moderate-snow';

  // Thunderstorm 95, with hail 96/99 (same tier — hail visuals deferred).
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';

  return 'partly-cloudy';
}

// Tier → discrete intensity. Tiers now name their own intensity, so the
// hourly precip mm/cm reading is no longer consulted here. Exhaustive switch
// — adding a new tier without a case is a compile error.
export function mapPrecipIntensity(tier: WeatherCondition): PrecipitationIntensity {
  switch (tier) {
    case 'light-rain':
    case 'light-snow':
      return 'light';
    case 'moderate-rain':
    case 'moderate-snow':
      return 'moderate';
    case 'heavy-rain':
    case 'heavy-snow':
    case 'thunderstorm':
      return 'heavy';
    case 'sunny':
    case 'partly-cloudy':
    case 'overcast':
    case 'foggy':
      return 'none';
    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unhandled WeatherCondition in mapPrecipIntensity: ${_exhaustive}`);
    }
  }
}

// Continuous fog-density multiplier driven by visibility. 0..1.2 cap.
// Piecewise linear so 3B can drive cloud opacity / dimming smoothly.
export function mapFogDensity(visibilityM: number): number {
  if (visibilityM >= 4000) return 0;
  if (visibilityM >= 1000) {
    return 0.5 * (1 - (visibilityM - 1000) / 3000);
  }
  if (visibilityM >= 500) {
    return 0.5 + 0.35 * (1 - (visibilityM - 500) / 500);
  }
  return Math.min(1.2, 0.85 + 0.35 * (1 - visibilityM / 500));
}

// Tier-family predicates. Useful for layer scoping (RainLayer/SnowLayer/
// AnnotationStrip etc.) so callers don't enumerate three string literals.
export function isRainTier(tier: WeatherCondition): boolean {
  return tier === 'light-rain' || tier === 'moderate-rain' || tier === 'heavy-rain';
}

export function isSnowTier(tier: WeatherCondition): boolean {
  return tier === 'light-snow' || tier === 'moderate-snow' || tier === 'heavy-snow';
}

// Back-compat: derive the 7-value AtmosphereCondition consumed by 2A/2C
// visual components from the new 11-tier union. Snow tiers fall back to
// 'cloudy' until snow visuals land in the back-compat consumers.
export function deriveAtmosphereCondition(tier: WeatherCondition): AtmosphereCondition {
  switch (tier) {
    case 'sunny':         return 'sunny';
    case 'partly-cloudy': return 'cloudy';
    case 'overcast':      return 'cloudy';
    case 'foggy':         return 'foggy';
    case 'thunderstorm':  return 'thunderstorm';
    case 'light-rain':    return 'light_rain';
    case 'moderate-rain': return 'moderate_rain';
    case 'heavy-rain':    return 'heavy_rain';
    case 'light-snow':
    case 'moderate-snow':
    case 'heavy-snow':
      return 'cloudy';
    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unhandled WeatherCondition in deriveAtmosphereCondition: ${_exhaustive}`);
    }
  }
}
