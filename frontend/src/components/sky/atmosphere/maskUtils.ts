import { sampleIndexToInsetPercent } from '@/lib/timelineInset';
import type { SceneAtmosphere, WeatherCondition } from '@/lib/weather/types';

// Asymmetric (forward-biased) smoothing kernel.
//
// Replaces the symmetric 3-tap [0.25, 0.50, 0.25] with a 4-tap kernel
// [back, self, +1, +2] = [0.125, 0.5, 0.25, 0.125]. Forward weight
// (0.25 + 0.125 = 0.375) is 3× backward weight (0.125), giving the locked
// 45 min lead-in / 15 min lead-out ratio at the 30-min sample interval used
// by samples48 (1.5 samples ahead = 45 min, 0.5 sample behind = 15 min).
//
// Why forward-biased: weather visuals should anticipate (rain clouds start
// dimming the sky before the first drop) more than they linger (the air
// clears quickly once a front passes). Symmetric ramps had both edges
// looking equally "smudged"; asymmetric matches what people see.
//
// Verification: pass a unit step (0…0,1,1,1,0,0…); rising edge accumulates
// across two pre-edge samples (60 + 30 min before), falling edge bleeds
// only ~15 min past the last "on" sample. See assertions in any test added
// alongside this module.
const KERNEL_BACK = 0.125;
const KERNEL_SELF = 0.5;
const KERNEL_FWD1 = 0.25;
const KERNEL_FWD2 = 0.125;

// 4-tap forward-biased moving average. Accepts number[] or Float32Array;
// always returns Float32Array. Clamps neighbours at array boundaries.
export function smoothMask(raw: ArrayLike<number>): Float32Array {
  const n = raw.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const back = raw[Math.max(0, i - 1)];
    const self = raw[i];
    const fwd1 = raw[Math.min(n - 1, i + 1)];
    const fwd2 = raw[Math.min(n - 1, i + 2)];
    out[i] = KERNEL_BACK * back + KERNEL_SELF * self + KERNEL_FWD1 * fwd1 + KERNEL_FWD2 * fwd2;
  }
  return out;
}

// White-with-alpha mask gradient. Works in both alpha-mode and the legacy
// luminance-mode default (older Safari): white * alpha ≈ alpha for both.
export function buildWhiteMaskGradient(mask: ArrayLike<number>): string {
  const n = mask.length;
  const parts: string[] = ['rgba(255, 255, 255, 0) 0%'];
  for (let i = 0; i < n; i++) {
    const a = (mask[i] as number).toFixed(3);
    const pct = sampleIndexToInsetPercent(i, n).toFixed(3);
    parts.push(`rgba(255, 255, 255, ${a}) ${pct}%`);
  }
  parts.push('rgba(255, 255, 255, 0) 100%');
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

function asTierSet(
  tiers: WeatherCondition | ReadonlyArray<WeatherCondition>,
): Set<WeatherCondition> {
  return typeof tiers === 'string' ? new Set([tiers]) : new Set(tiers);
}

// 48-stop tint gradient scoped to one or more condition tiers. Non-matching
// samples get alpha = 0. Cool tints (r ≤ b) suit multiply; warm suit
// soft-light — callers set mixBlendMode accordingly.
export function buildConditionTintGradient(
  samples: SceneAtmosphere[],
  tiers: WeatherCondition | ReadonlyArray<WeatherCondition>,
): string {
  const match = asTierSet(tiers);
  const parts: string[] = [];
  const n = samples.length;
  const firstSample = samples[0];
  const r0 = Math.round(firstSample.tint.r);
  const g0 = Math.round(firstSample.tint.g);
  const b0 = Math.round(firstSample.tint.b);
  parts.push(`rgba(${r0}, ${g0}, ${b0}, 0) 0%`);
  for (let i = 0; i < n; i++) {
    const atmo = samples[i];
    const r = Math.round(atmo.tint.r);
    const g = Math.round(atmo.tint.g);
    const b = Math.round(atmo.tint.b);
    const a = match.has(atmo.conditionTier) ? atmo.tint.a.toFixed(3) : '0.000';
    const pct = sampleIndexToInsetPercent(i, n).toFixed(3);
    parts.push(`rgba(${r}, ${g}, ${b}, ${a}) ${pct}%`);
  }
  const lastSample = samples[n - 1];
  const rl = Math.round(lastSample.tint.r);
  const gl = Math.round(lastSample.tint.g);
  const bl = Math.round(lastSample.tint.b);
  parts.push(`rgba(${rl}, ${gl}, ${bl}, 0) 100%`);
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

// 48-stop dimming gradient scoped to one or more condition tiers.
// Non-matching samples get alpha = 0. Uses fixed dark base color (8, 10, 16).
export function buildConditionDimmingGradient(
  samples: SceneAtmosphere[],
  tiers: WeatherCondition | ReadonlyArray<WeatherCondition>,
): string {
  const match = asTierSet(tiers);
  const parts: string[] = ['rgba(8, 10, 16, 0) 0%'];
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const atmo = samples[i];
    const a = match.has(atmo.conditionTier) ? atmo.dimming.toFixed(3) : '0.000';
    const pct = sampleIndexToInsetPercent(i, n).toFixed(3);
    parts.push(`rgba(8, 10, 16, ${a}) ${pct}%`);
  }
  parts.push('rgba(8, 10, 16, 0) 100%');
  return `linear-gradient(to right, ${parts.join(', ')})`;
}
