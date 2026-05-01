'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';
import { sampleIndexToPercent } from '@/lib/weather/spatial';

// 48-stop horizontal gradient of fixed-color dimming. Per-stop alpha =
// atmo.dimming, so heavy-rain hours dim that x-region while sunny hours
// pass through clear.
export default function DimmingOverlay() {
  const { samples48 } = useSceneWeather();

  const gradient = useMemo(() => {
    const parts: string[] = [];
    const n = samples48.length;
    for (let i = 0; i < n; i++) {
      const a = samples48[i].dimming;
      const pct = sampleIndexToPercent(i, n).toFixed(3);
      parts.push(`rgba(8, 10, 16, ${a.toFixed(3)}) ${pct}%`);
    }
    return `linear-gradient(to right, ${parts.join(', ')})`;
  }, [samples48]);

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
      animate={{ backgroundImage: gradient }}
      initial={false}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
    />
  );
}
