'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';

interface Props {
  sunPositionPct: { x: number; y: number };
}

// SunnyGlow stays radially anchored to the sun — its center isn't on a
// gradient, it's a single point. But the *visibility* and *warmth* of the
// glow should reflect weather AT the sun's x-position (3B horizontal
// mapping principle): a noon sun behind a stormy 14:00 region should not
// glow brightly just because midnight is sunny.
export default function SunnyGlow({ sunPositionPct }: Props) {
  const { samples48 } = useSceneWeather();

  // Map sun's x-pct into the closest 48-sample bucket.
  const atmoAtSun = useMemo(() => {
    const n = samples48.length;
    const idx = Math.min(
      n - 1,
      Math.max(0, Math.round((sunPositionPct.x / 100) * (n - 1))),
    );
    return samples48[idx];
  }, [samples48, sunPositionPct.x]);

  const visible = atmoAtSun.sunVisible
    && atmoAtSun.sunMood !== 'hidden'
    && atmoAtSun.sunMood !== 'muted';

  const goldenHourActive = atmoAtSun.goldenHourActive;

  const innerStop = goldenHourActive
    ? 'rgba(255, 180, 110, 0.32)'
    : 'rgba(255, 220, 140, 0.18)';
  const midStop = goldenHourActive
    ? 'rgba(255, 180, 110, 0.14)'
    : 'rgba(255, 220, 140, 0.08)';
  const gradient = `radial-gradient(circle at ${sunPositionPct.x.toFixed(1)}% ${sunPositionPct.y.toFixed(1)}%, ${innerStop} 0%, ${midStop} 25%, transparent 60%)`;

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
      animate={{
        background: gradient,
        opacity: visible ? 1 : 0,
      }}
      initial={false}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    />
  );
}
