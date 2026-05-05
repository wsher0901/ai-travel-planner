'use client';
import { useMemo } from 'react';
import { useSceneWeather } from '../SceneAtmosphere';
import { buildWhiteMaskGradient } from '../maskUtils';
import { isSnowTier } from '@/lib/weather/mapping';
import type { SceneAtmosphere } from '@/lib/weather/types';

// 3 cumulative snow groups producing tier-proportional density:
//   light zones  show group L only           = 12 particles
//   moderate     show groups L + M           = 12 + 12 = 24
//   heavy        show groups L + M + H       = 12 + 12 + 16 = 40
//
// Each group is masked separately so a moderate-snow x-region renders
// the L (always-snow) and M (moderate-or-heavy) groups but not H (heavy
// only). Particles are <circle> elements wrapped in <g class="sky-snowfall">
// with per-particle negative animation-delay.
//
// Replaces the prior canvas particle physics; trade-off: lose per-x wind
// reactivity and natural sway, gain GPU-accelerated transforms and a much
// simpler rendering pipeline.

const VIEWBOX_W = 100;
const VIEWBOX_H = 100;

const LIGHT_COUNT = 12;
const MODERATE_ADD = 12;
const HEAVY_ADD = 16;

const SNOWFALL_DURATION_S = 12;

interface ParticleSpec {
  cx: number;
  cy: number;
  r: number;
  delay: number;
  opacity: number;
}

// Deterministic pseudo-random — keeps particle positions stable across
// renders so React's reconciliation doesn't churn keys.
function pseudo(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function generate(count: number, salt: number): ReadonlyArray<ParticleSpec> {
  const out: ParticleSpec[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      cx:      pseudo(i, salt + 1) * VIEWBOX_W,
      cy:      pseudo(i, salt + 2) * VIEWBOX_H * 0.2, // start near top
      r:       1.4 + pseudo(i, salt + 3) * 0.4,        // 1.4–1.8
      delay:   -pseudo(i, salt + 4) * SNOWFALL_DURATION_S,
      opacity: 0.85 + pseudo(i, salt + 5) * 0.10,
    });
  }
  return out;
}

const LIGHT_PARTICLES    = generate(LIGHT_COUNT,    1);
const MODERATE_PARTICLES = generate(MODERATE_ADD,   2);
const HEAVY_PARTICLES    = generate(HEAVY_ADD,      3);

// Cumulative tier predicates.
function inAnySnow(atmo: SceneAtmosphere): boolean {
  return isSnowTier(atmo.conditionTier);
}
function inModerateOrHeavySnow(atmo: SceneAtmosphere): boolean {
  return atmo.conditionTier === 'moderate-snow' || atmo.conditionTier === 'heavy-snow';
}
function inHeavySnow(atmo: SceneAtmosphere): boolean {
  return atmo.conditionTier === 'heavy-snow';
}

interface SnowGroupProps {
  particles: ReadonlyArray<ParticleSpec>;
  mask: string;
}

function SnowGroup({ particles, mask }: SnowGroupProps) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="none"
      >
        {particles.map((p, i) => (
          <g
            key={i}
            className="sky-snowfall"
            style={{ animationDelay: `${p.delay}s` }}
          >
            <circle cx={p.cx} cy={p.cy} r={p.r} fill="white" opacity={p.opacity} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function SnowLayer() {
  const { samples48 } = useSceneWeather();

  // Per-group short-circuit: each mask is built ONLY if its predicate matches
  // at least one sample. A light-only-snow day skips the moderate/heavy
  // groups entirely (no SVG mount, no GPU layer for them) — without this,
  // the all-zero masks would still mount the SVG subtrees behind invisible
  // masks.
  const { lightMask, moderateMask, heavyMask } = useMemo(() => {
    const anyLight    = samples48.some(inAnySnow);
    const anyModOrHi  = samples48.some(inModerateOrHeavySnow);
    const anyHeavy    = samples48.some(inHeavySnow);
    return {
      lightMask:    anyLight   ? buildWhiteMaskGradient(samples48, inAnySnow)             : null,
      moderateMask: anyModOrHi ? buildWhiteMaskGradient(samples48, inModerateOrHeavySnow) : null,
      heavyMask:    anyHeavy   ? buildWhiteMaskGradient(samples48, inHeavySnow)           : null,
    };
  }, [samples48]);

  if (!lightMask && !moderateMask && !heavyMask) return null;

  return (
    <>
      {lightMask    && <SnowGroup particles={LIGHT_PARTICLES}    mask={lightMask}    />}
      {moderateMask && <SnowGroup particles={MODERATE_PARTICLES} mask={moderateMask} />}
      {heavyMask    && <SnowGroup particles={HEAVY_PARTICLES}    mask={heavyMask}    />}
    </>
  );
}
