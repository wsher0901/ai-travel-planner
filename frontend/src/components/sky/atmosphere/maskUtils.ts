import { sampleIndexToPercent } from '@/lib/weather/spatial';
import type { SceneAtmosphere, WeatherCondition } from '@/lib/weather/types';

// 3-tap moving average. Accepts number[] or Float32Array; always returns
// Float32Array. Clamps neighbors at array boundaries.
export function smoothMask(raw: ArrayLike<number>): Float32Array {
  const n = raw.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(n - 1, i + 1)];
    out[i] = (a + b + c) / 3;
  }
  return out;
}

// White-with-alpha mask gradient. Works in both alpha-mode and the legacy
// luminance-mode default (older Safari): white * alpha ≈ alpha for both.
export function buildWhiteMaskGradient(mask: ArrayLike<number>): string {
  const n = mask.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (mask[i] as number).toFixed(3);
    const pct = sampleIndexToPercent(i, n).toFixed(3);
    parts.push(`rgba(255, 255, 255, ${a}) ${pct}%`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

// 48-stop tint gradient scoped to one condition tier. Non-matching samples
// get alpha = 0. Cool tints (r ≤ b) suit multiply; warm suit soft-light —
// callers set mixBlendMode accordingly.
export function buildConditionTintGradient(
  samples: SceneAtmosphere[],
  tier: WeatherCondition,
): string {
  const parts: string[] = [];
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const atmo = samples[i];
    const r = Math.round(atmo.tint.r);
    const g = Math.round(atmo.tint.g);
    const b = Math.round(atmo.tint.b);
    const a = atmo.conditionTier === tier ? atmo.tint.a.toFixed(3) : '0.000';
    const pct = sampleIndexToPercent(i, n).toFixed(3);
    parts.push(`rgba(${r}, ${g}, ${b}, ${a}) ${pct}%`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

// 48-stop dimming gradient scoped to one condition tier. Non-matching samples
// get alpha = 0. Uses fixed dark base color (8, 10, 16).
export function buildConditionDimmingGradient(
  samples: SceneAtmosphere[],
  tier: WeatherCondition,
): string {
  const parts: string[] = [];
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const atmo = samples[i];
    const a = atmo.conditionTier === tier ? atmo.dimming.toFixed(3) : '0.000';
    const pct = sampleIndexToPercent(i, n).toFixed(3);
    parts.push(`rgba(8, 10, 16, ${a}) ${pct}%`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}
