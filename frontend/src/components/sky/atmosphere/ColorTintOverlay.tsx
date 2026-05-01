'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';
import { sampleIndexToPercent } from '@/lib/weather/spatial';
import type { SceneAtmosphere } from '@/lib/weather/types';

// Two stacked overlays: cool tints go through `multiply`, warm tints
// through `soft-light`. Each builds a horizontal 48-stop linear-gradient.
// At each stop, only the matching side carries non-zero alpha — the other
// is zeroed so the wrong blend mode never kicks in. CSS interpolates
// linearly between adjacent stops, so the warm/cool handoff is always
// visually smooth even when the underlying tier flips between hours.

function buildGradient(
  samples: SceneAtmosphere[],
  pickAlpha: (atmo: SceneAtmosphere) => number,
): string {
  const parts: string[] = [];
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const atmo = samples[i];
    const alpha = pickAlpha(atmo);
    const pct = sampleIndexToPercent(i, n).toFixed(3);
    const r = Math.round(atmo.tint.r);
    const g = Math.round(atmo.tint.g);
    const b = Math.round(atmo.tint.b);
    parts.push(`rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)}) ${pct}%`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

export default function ColorTintOverlay() {
  const { samples48 } = useSceneWeather();

  const { coolGradient, warmGradient } = useMemo(() => ({
    coolGradient: buildGradient(samples48, (atmo) => (atmo.tint.r > atmo.tint.b ? 0 : atmo.tint.a)),
    warmGradient: buildGradient(samples48, (atmo) => (atmo.tint.r > atmo.tint.b ? atmo.tint.a : 0)),
  }), [samples48]);

  return (
    <>
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
        animate={{ backgroundImage: coolGradient }}
        initial={false}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'soft-light',
        }}
        animate={{ backgroundImage: warmGradient }}
        initial={false}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
    </>
  );
}
