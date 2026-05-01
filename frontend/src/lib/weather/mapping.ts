import type {
  AtmosphereCondition,
  HourlyWeather,
  PrecipitationIntensity,
  WeatherCondition,
} from './types';

// WMO weather_code → conditionTier with a visibility override for fog.
// Reference: https://open-meteo.com/en/docs (weather_code section)
//
// Cloudy-family split:
//   0 = clear sky         → 'sunny' (<60% cloud) or 'partly-cloudy' (≥60%)
//   1 = mainly clear      → 'sunny' (<60% cloud) or 'partly-cloudy' (≥60%)
//   2 = partly cloudy     → 'partly-cloudy' (<80%) or 'overcast' (≥80%)
//   3 = overcast          → 'overcast' (always)
// Fallback is 'partly-cloudy' (chosen as the most neutral middle-ground).
export function mapToConditionTier(h: HourlyWeather): WeatherCondition {
  // Visibility-driven fog override — heavy fog can occur with code 0/1.
  if (h.visibilityM < 4000) return 'fog';

  const code = h.weatherCode;

  if (code === 0) return h.cloudCover < 60 ? 'sunny' : 'partly-cloudy';
  if (code === 1) return h.cloudCover < 60 ? 'sunny' : 'partly-cloudy';
  if (code === 2) return h.cloudCover < 80 ? 'partly-cloudy' : 'overcast';
  if (code === 3) return 'overcast';
  // 45, 48 = fog / depositing rime fog.
  if (code === 45 || code === 48) return 'fog';
  // 71-77 = snow fall, 85-86 = snow showers.
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  // 95-99 = thunderstorm (with hail at 96/99).
  if (code >= 95 && code <= 99) return 'storm';
  // 51-67 = drizzle/rain (incl. freezing), 80-82 = rain showers.
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';

  return 'partly-cloudy';
}

export function mapPrecipIntensity(
  tier: WeatherCondition,
  h: HourlyWeather,
): PrecipitationIntensity {
  if (tier === 'rain' || tier === 'storm') {
    const mm = h.precipitationMmHr;
    if (mm < 0.5) return 'light';
    if (mm < 4) return 'moderate';
    return 'heavy';
  }
  if (tier === 'snow') {
    const cm = h.snowfallCmHr;
    if (cm < 0.5) return 'light';
    if (cm < 2) return 'moderate';
    return 'heavy';
  }
  return 'none';
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

// Back-compat: derive AtmosphereCondition (the 7-value union 2A/2C consume)
// from (tier, precipitationIntensity). Both new cloudy-family tiers map to
// 'cloudy'; snow falls back to 'cloudy' (no snow visuals yet in 2A/2C).
export function deriveAtmosphereCondition(
  tier: WeatherCondition,
  precip: PrecipitationIntensity,
): AtmosphereCondition {
  switch (tier) {
    case 'sunny':         return 'sunny';
    case 'partly-cloudy': return 'cloudy';
    case 'overcast':      return 'cloudy';
    case 'fog':           return 'foggy';
    case 'storm':         return 'thunderstorm';
    case 'rain':
      if (precip === 'light')    return 'light_rain';
      if (precip === 'moderate') return 'moderate_rain';
      return 'heavy_rain';
    case 'snow':
      return 'cloudy';
    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unhandled WeatherCondition in deriveAtmosphereCondition: ${_exhaustive}`);
    }
  }
}
