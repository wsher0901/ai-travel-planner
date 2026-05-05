import {
  deriveAtmosphereCondition,
  mapFogDensity,
  mapPrecipIntensity,
  mapToConditionTier,
} from './mapping';
import type {
  DayMeta,
  DayWeather,
  HourlyWeather,
  SceneAtmosphere,
  SunMood,
  WeatherCondition,
} from './types';

const GOLDEN_HOUR_WINDOW_MIN = 45;

export interface TierGradient {
  top: string;    // hex — sky zenith
  mid: string;    // hex — middle band
  bottom: string; // hex — horizon
}

interface TierConfig {
  // Locked-spec parameters consumed by Prompt 4/5 layers (cloud silhouettes,
  // ceiling band, etc.). The atmosphere pipeline today reads only `tint` /
  // `dimming` / `intensity`, but the gradient + lightness/saturation are
  // surfaced here so future layers don't re-derive them.
  lightness: number;            // 0..1
  saturation: number;           // 0..1
  gradient: TierGradient;       // 3-stop sky gradient (hex)
  tint: [number, number, number, number]; // r, g, b, a — single-tint overlay
  dimming: number;
  intensity: number;
}

// Per-tier atmosphere config — locked 11-tier spec. Lightness/saturation/
// gradient values match the 3B color spec exactly. The `tint` rgba is the
// representative single-color overlay used by buildConditionTintGradient
// (kept distinct from the 3-stop gradient so existing tier-scoped overlays
// don't change character).
//
// Note: overcast and moderate-rain share lightness 0.38 and the same
// gradient hex stack — they're distinguished by the ceiling band (Prompt 4),
// not by overall sky brightness.
function getTierConfig(tier: WeatherCondition): TierConfig {
  switch (tier) {
    case 'sunny':
      return {
        lightness: 0.90,
        saturation: 0.85,
        gradient:   { top: '#5BA8DD', mid: '#94C8E8', bottom: '#F4D080' },
        tint:       [255, 220, 140, 0.04],
        dimming:    0,
        intensity:  0,
      };
    case 'partly-cloudy':
      return {
        lightness: 0.78,
        saturation: 0.65,
        gradient:   { top: '#5891C8', mid: '#8AAFD4', bottom: '#B0C8DE' },
        tint:       [180, 195, 215, 0.06],
        dimming:    0.04,
        intensity:  0.20,
      };
    case 'overcast':
      return {
        lightness: 0.38,
        saturation: 0.30,
        gradient:   { top: '#34516D', mid: '#506A85', bottom: '#6C849C' },
        tint:       [170, 185, 205, 0.14],
        dimming:    0.12,
        intensity:  0.45,
      };
    case 'foggy':
      return {
        lightness: 0.65,
        saturation: 0.10,
        gradient:   { top: '#A4A8AC', mid: '#B4B8BB', bottom: '#C5C8CB' },
        tint:       [200, 205, 215, 0.18],
        dimming:    0.12,
        intensity:  0.55,
      };
    case 'light-rain':
      return {
        lightness: 0.55,
        saturation: 0.40,
        gradient:   { top: '#557799', mid: '#7392B0', bottom: '#91A8C0' },
        tint:       [150, 165, 185, 0.14],
        dimming:    0.15,
        intensity:  0.35,
      };
    case 'moderate-rain':
      return {
        lightness: 0.38,
        saturation: 0.45,
        gradient:   { top: '#34516D', mid: '#506A85', bottom: '#6C849C' },
        tint:       [120, 135, 160, 0.18],
        dimming:    0.22,
        intensity:  0.60,
      };
    case 'heavy-rain':
      return {
        lightness: 0.26,
        saturation: 0.50,
        gradient:   { top: '#1F354B', mid: '#354B62', bottom: '#4C6178' },
        tint:       [ 90, 105, 130, 0.24],
        dimming:    0.30,
        intensity:  0.85,
      };
    case 'thunderstorm':
      return {
        lightness: 0.16,
        saturation: 0.55,
        gradient:   { top: '#0F1721', mid: '#1E2935', bottom: '#2D3845' },
        tint:       [ 70,  80, 100, 0.28],
        dimming:    0.36,
        intensity:  1.0,
      };
    case 'light-snow':
      return {
        lightness: 0.68,
        saturation: 0.15,
        gradient:   { top: '#8E97A0', mid: '#A2ABB3', bottom: '#B6BCC2' },
        tint:       [220, 225, 245, 0.10],
        dimming:    0.08,
        intensity:  0.30,
      };
    case 'moderate-snow':
      return {
        lightness: 0.75,
        saturation: 0.10,
        gradient:   { top: '#9FA9B0', mid: '#B3BBC2', bottom: '#C5CACF' },
        tint:       [220, 225, 245, 0.16],
        dimming:    0.14,
        intensity:  0.55,
      };
    case 'heavy-snow':
      return {
        lightness: 0.82,
        saturation: 0.05,
        gradient:   { top: '#B5BDC4', mid: '#C5CCD2', bottom: '#D3D8DD' },
        tint:       [225, 230, 250, 0.22],
        dimming:    0.20,
        intensity:  0.80,
      };
    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unhandled WeatherCondition in getTierConfig: ${_exhaustive}`);
    }
  }
}

// Pull HH:MM from a Date, treating it as destination-local clock time.
// (Open-Meteo with timezone=auto returns local clock strings, so we only
// need the hour/minute components — never the absolute timestamp.)
function clockMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function computeSunMood(
  tier: WeatherCondition,
  goldenHourActive: boolean,
): SunMood {
  switch (tier) {
    case 'thunderstorm':
      return 'hidden';
    case 'foggy':
    case 'light-rain':
    case 'moderate-rain':
    case 'heavy-rain':
    case 'light-snow':
    case 'moderate-snow':
    case 'heavy-snow':
      return 'muted';
    // Heavy cloud cover dims the sun even without precipitation.
    case 'overcast':
      return goldenHourActive ? 'warm' : 'muted';
    // Only clear-sky tiers get full golden-hour warmth.
    case 'sunny':
    case 'partly-cloudy':
      return goldenHourActive ? 'warm' : 'normal';
    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unhandled WeatherCondition in computeSunMood: ${_exhaustive}`);
    }
  }
}

// Pure: single hourly snapshot → SceneAtmosphere.
export function getHourlyAtmosphere(
  h: HourlyWeather,
  daily: DayMeta,
  hourFloat: number,
): SceneAtmosphere {
  const tier = mapToConditionTier(h);
  const precip = mapPrecipIntensity(tier);
  const fogDensityMultiplier = mapFogDensity(h.visibilityM);

  const cfg = getTierConfig(tier);
  const [r0, g0, b0, a] = cfg.tint;

  const sunriseMin = clockMinutes(daily.sunrise);
  const sunsetMin = clockMinutes(daily.sunset);
  const currentMin = hourFloat * 60;

  const minutesFromSunrise = Math.abs(currentMin - sunriseMin);
  const minutesFromSunset = Math.abs(currentMin - sunsetMin);
  const nearGolden =
    minutesFromSunrise <= GOLDEN_HOUR_WINDOW_MIN ||
    minutesFromSunset <= GOLDEN_HOUR_WINDOW_MIN;

  // Only clear-sky tiers qualify for golden-hour warming. Overcast no longer
  // qualifies (Prompt 3a) — its sun is muted regardless of clock time.
  const goldenHourActive = nearGolden && (
    tier === 'sunny' || tier === 'partly-cloudy'
  );

  let r = r0, g = g0, b = b0;
  if (goldenHourActive) {
    r = Math.min(255, r0 * 1.15);
    g = Math.min(255, g0 * 1.15);
  }

  const sunVisible = currentMin >= sunriseMin && currentMin <= sunsetMin;
  const sunMood = computeSunMood(tier, goldenHourActive);

  return {
    tint: { r, g, b, a },
    dimming: cfg.dimming,
    sunVisible,
    sunMood,
    goldenHourActive,
    windVector: { angleDeg: h.windAngleDeg, speedMps: h.windSpeedMps },
    conditionTier: tier,
    precipitationIntensity: precip,
    intensity: cfg.intensity,
    fogDensityMultiplier,
    condition: deriveAtmosphereCondition(tier),
    windy: h.windSpeedMps >= 7,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Shortest-arc interpolation between two compass angles (0..360).
function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return ((a + delta * t) + 360) % 360;
}

function clampHourIndex(hour: number, len: number): number {
  if (hour < 0) return 0;
  if (hour >= len) return len - 1;
  return hour;
}

const CROSSFADE_MIN = 10; // minutes either side of the integer hour boundary

// Hourly tier handoff. Discrete fields don't blend, but we expose primary +
// secondary weights so callers (3B) can crossfade visuals across the boundary.
export interface DiscreteCrossfade {
  primary: {
    tier: WeatherCondition;
    intensity: number;
    weight: number;
  };
  secondary: {
    tier: WeatherCondition;
    intensity: number;
    weight: number;
  } | null;
}

export function getDiscreteCrossfade(
  day: DayWeather,
  hourFloat: number,
): DiscreteCrossfade {
  const len = day.hourly.length;
  if (len === 0) {
    return { primary: { tier: 'sunny', intensity: 0, weight: 1 }, secondary: null };
  }

  const fractional = hourFloat - Math.floor(hourFloat);
  const minuteOfHour = fractional * 60;

  const hLow = clampHourIndex(Math.floor(hourFloat), len);
  const hHigh = clampHourIndex(Math.ceil(hourFloat), len);

  const aLow = getHourlyAtmosphere(day.hourly[hLow], day.daily, hLow);
  const aHigh = getHourlyAtmosphere(day.hourly[hHigh], day.daily, hHigh);

  const sameTier = aLow.conditionTier === aHigh.conditionTier;

  // Are we within ±10 min of an integer hour boundary?
  const distFromBoundary = Math.min(minuteOfHour, 60 - minuteOfHour);
  const inBoundary = distFromBoundary <= CROSSFADE_MIN;

  if (!inBoundary || sameTier) {
    return {
      primary: { tier: aLow.conditionTier, intensity: aLow.intensity, weight: 1 },
      secondary: null,
    };
  }

  // Within crossfade window — weight by position inside ±10 min.
  // weight ramps 0 → 1 as minute moves from boundary edge to center.
  // At exactly the boundary (0 or 60), secondary weight = 0.5; we expose
  // the *neighbour* hour as secondary so callers can blend toward it.
  let secondaryAtmos = aHigh;
  let secondaryWeight: number;

  if (minuteOfHour < CROSSFADE_MIN) {
    // Nearing top of hour from previous hour — secondary is hLow's predecessor (or hLow itself if at start)
    const prevIdx = clampHourIndex(hLow - 1, len);
    secondaryAtmos = getHourlyAtmosphere(day.hourly[prevIdx], day.daily, prevIdx);
    secondaryWeight = (CROSSFADE_MIN - minuteOfHour) / (2 * CROSSFADE_MIN); // 0.5 at boundary, 0 at edge
  } else {
    // Past 50 min — leaning toward hHigh.
    secondaryWeight = (minuteOfHour - (60 - CROSSFADE_MIN)) / (2 * CROSSFADE_MIN); // 0 at edge, 0.5 at boundary
  }

  if (secondaryAtmos.conditionTier === aLow.conditionTier) {
    // Adjacent neighbour shares tier → no crossfade needed.
    return {
      primary: { tier: aLow.conditionTier, intensity: aLow.intensity, weight: 1 },
      secondary: null,
    };
  }

  return {
    primary: {
      tier: aLow.conditionTier,
      intensity: aLow.intensity,
      weight: 1 - secondaryWeight,
    },
    secondary: {
      tier: secondaryAtmos.conditionTier,
      intensity: secondaryAtmos.intensity,
      weight: secondaryWeight,
    },
  };
}

// Continuous fields linearly blended; discrete fields take hLow's value.
// (Use getDiscreteCrossfade for boundary-crossing visuals.)
export function getAtmosphereAtTime(
  day: DayWeather,
  hourFloat: number,
): SceneAtmosphere {
  const len = day.hourly.length;
  if (len === 0) {
    throw new Error('getAtmosphereAtTime: day.hourly is empty');
  }

  const hLow = clampHourIndex(Math.floor(hourFloat), len);
  const hHigh = clampHourIndex(Math.ceil(hourFloat), len);
  const factor = hLow === hHigh ? 0 : hourFloat - hLow;

  const aLow = getHourlyAtmosphere(day.hourly[hLow], day.daily, hLow);
  if (factor === 0) return aLow;

  const aHigh = getHourlyAtmosphere(day.hourly[hHigh], day.daily, hHigh);

  return {
    tint: {
      r: lerp(aLow.tint.r, aHigh.tint.r, factor),
      g: lerp(aLow.tint.g, aHigh.tint.g, factor),
      b: lerp(aLow.tint.b, aHigh.tint.b, factor),
      a: lerp(aLow.tint.a, aHigh.tint.a, factor),
    },
    dimming: lerp(aLow.dimming, aHigh.dimming, factor),
    // Sun-related discrete fields: take the slot whose hour boundary the
    // moment actually sits in (hLow). sunVisible/sunMood/goldenHourActive
    // are recomputed from the integer hour anchor.
    sunVisible: aLow.sunVisible,
    sunMood: aLow.sunMood,
    goldenHourActive: aLow.goldenHourActive,
    windVector: {
      angleDeg: lerpAngle(aLow.windVector.angleDeg, aHigh.windVector.angleDeg, factor),
      speedMps: lerp(aLow.windVector.speedMps, aHigh.windVector.speedMps, factor),
    },
    conditionTier: aLow.conditionTier,
    precipitationIntensity: aLow.precipitationIntensity,
    intensity: lerp(aLow.intensity, aHigh.intensity, factor),
    fogDensityMultiplier: lerp(aLow.fogDensityMultiplier, aHigh.fogDensityMultiplier, factor),
    condition: aLow.condition,
    windy: aLow.windy,
  };
}

// Sample atmosphere across a full day. Used by 3B for horizontal gradient
// stops. samples=48 → every 30 min.
export function getAtmosphereAcrossDay(
  day: DayWeather,
  samples = 48,
): SceneAtmosphere[] {
  if (samples <= 0) return [];
  const out: SceneAtmosphere[] = new Array(samples);
  for (let i = 0; i < samples; i++) {
    const hourFloat = (i / samples) * 24;
    out[i] = getAtmosphereAtTime(day, hourFloat);
  }
  return out;
}
