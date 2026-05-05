'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';
import { sampleIndexToPercent } from '@/lib/weather/spatial';
import type { WeatherCondition } from '@/lib/weather/types';

const ACTIVE_ALPHA = 0.10;
const WARM_R = 255;
const WARM_G = 175;
const WARM_B = 110;

// Tiers eligible for the golden-hour wash. Locked-spec gate: only the two
// clear-sky tiers warm. Overcast (formerly eligible) and the 9 precipitation/
// fog tiers all suppress the wash. Per-sample so a strip with sunny→overcast
// at the 6:30 AM boundary correctly shows the wash up to 6:30 and drops it
// cleanly into the overcast hour.
const ELIGIBLE_TIERS: ReadonlySet<WeatherCondition> = new Set<WeatherCondition>([
  'sunny',
  'partly-cloudy',
]);

export default function GoldenHourWash() {
  const { samples48 } = useSceneWeather();

  const { gradient, anyActive } = useMemo(() => {
    const parts: string[] = [];
    const n = samples48.length;
    let anyActive = false;
    for (let i = 0; i < n; i++) {
      const s = samples48[i];
      const eligible = s.goldenHourActive && ELIGIBLE_TIERS.has(s.conditionTier);
      if (eligible) anyActive = true;
      const a = eligible ? ACTIVE_ALPHA : 0;
      const pct = sampleIndexToPercent(i, n).toFixed(3);
      parts.push(`rgba(${WARM_R}, ${WARM_G}, ${WARM_B}, ${a.toFixed(3)}) ${pct}%`);
    }
    return {
      gradient: `linear-gradient(to right, ${parts.join(', ')})`,
      anyActive,
    };
  }, [samples48]);

  // No eligible sample anywhere on the strip — render nothing. Saves a
  // compositor layer when the whole day is overcast/precip/fog.
  if (!anyActive) return null;

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'soft-light',
      }}
      animate={{ backgroundImage: gradient }}
      initial={false}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    />
  );
}
