'use client';
import { useEffect, useMemo, type CSSProperties } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';
import { setLightningFlashActive } from './lightningFlashState';
import { sampleIndexToPercent } from '@/lib/weather/spatial';
import type { SceneAtmosphere } from '@/lib/weather/types';

// Storm-only full-strip pulse, but clipped to x-regions where any hour has
// conditionTier === 'storm'. Mask is computed once per samples48 update;
// the flash itself uses the same Framer keyframe sequence as before.
// Broadcasts active state via lightningFlashState so RainField can
// brighten particles in sync.

const FLASH_DURATION_S = 0.380;
const FLASH_OPACITIES = [0, 0.55, 0, 0.75, 0.25, 0] as const;
const FLASH_TIMES = [0, 60 / 380, 100 / 380, 180 / 380, 280 / 380, 1] as const;

const MIN_INTERVAL_MS = 8000;
const MAX_INTERVAL_MS = 12000;
const FIRST_FLASH_MIN_MS = 1500;
const FIRST_FLASH_MAX_MS = 3500;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Per-x mask: 1 in storm regions, 0 elsewhere, smoothed for soft edges.
function buildStormMask(samples: SceneAtmosphere[]): { image: string; anyStorm: boolean } {
  const raw = new Float32Array(samples.length);
  let anyStorm = false;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].conditionTier === 'storm') {
      raw[i] = 1;
      anyStorm = true;
    }
  }
  if (!anyStorm) {
    // Fully transparent mask — flash will never be scheduled anyway, but
    // keep a valid gradient so the property doesn't go undefined.
    return { image: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 100%)', anyStorm: false };
  }
  // 3-tap smoothing → ±30 min feathering at storm-region edges.
  const sm = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(samples.length - 1, i + 1)];
    sm[i] = (a + b + c) / 3;
  }
  const parts: string[] = [];
  for (let i = 0; i < sm.length; i++) {
    const a = sm[i].toFixed(3);
    const pct = sampleIndexToPercent(i, sm.length).toFixed(3);
    // White-with-alpha works in both alpha- and luminance-mode mask browsers.
    parts.push(`rgba(255, 255, 255, ${a}) ${pct}%`);
  }
  return { image: `linear-gradient(to right, ${parts.join(', ')})`, anyStorm: true };
}

export default function LightningFlash() {
  const { samples48 } = useSceneWeather();
  const { image: maskImage, anyStorm } = useMemo(() => buildStormMask(samples48), [samples48]);

  const controls = useAnimationControls();

  useEffect(() => {
    // Only schedule flashes when at least one hour is storm.
    if (!anyStorm) return;

    let timeoutId: number | null = null;
    let cancelled = false;

    const triggerFlash = async (): Promise<void> => {
      if (cancelled) return;
      setLightningFlashActive(true);
      try {
        await controls.start({
          opacity: [...FLASH_OPACITIES],
          transition: {
            duration: FLASH_DURATION_S,
            times: [...FLASH_TIMES],
            ease: 'easeOut',
          },
        });
      } catch {
        // Animation interrupted (unmount / mask change). Ignore.
      }
      if (cancelled) return;
      setLightningFlashActive(false);
      const delay = randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
      timeoutId = window.setTimeout(triggerFlash, delay);
    };

    const firstDelay = randomBetween(FIRST_FLASH_MIN_MS, FIRST_FLASH_MAX_MS);
    timeoutId = window.setTimeout(triggerFlash, firstDelay);

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      setLightningFlashActive(false);
      controls.stop();
      controls.set({ opacity: 0 });
    };
  }, [anyStorm, controls]);

  const maskStyle: CSSProperties = {
    maskImage,
    WebkitMaskImage: maskImage,
  };

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundColor: 'rgb(230, 240, 255)',
        mixBlendMode: 'screen',
        ...maskStyle,
      }}
      initial={{ opacity: 0 }}
      animate={controls}
    />
  );
}
