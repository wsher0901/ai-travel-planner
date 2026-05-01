'use client';
import { useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from '../SceneAtmosphere';
import {
  smoothMask,
  buildWhiteMaskGradient,
  buildConditionTintGradient,
  buildConditionDimmingGradient,
} from '../maskUtils';
import type { SceneAtmosphere } from '@/lib/weather/types';

// 3-band stacked fog. Bands are 200% wide and translate 0% → -50% (or
// reverse) for seamless tiled drift. Vertical density falloff via linear
// gradient; radial blobs add horizontal variation so drift is visible.
//
// Owns: fog-scoped tint (multiply) + dimming, plus the band effect (screen).
// Wind bug fixed (G5): noonAtmo derivation is inside the useMemo so drift
// duration recomputes whenever samples48 changes.

interface BandSpec {
  height: string;
  rgb: string;
  bottomAlpha: number;
  midAlpha: number;
  midStop: number;
  blobAlpha: number;
  driftMul: number;
}

const BANDS: BandSpec[] = [
  { height: '65%', rgb: '200, 210, 225', bottomAlpha: 0.18, midAlpha: 0.04, midStop: 60, blobAlpha: 0.10, driftMul: 2.4 },
  { height: '45%', rgb: '210, 215, 230', bottomAlpha: 0.28, midAlpha: 0.06, midStop: 70, blobAlpha: 0.16, driftMul: 1.6 },
  { height: '30%', rgb: '220, 225, 240', bottomAlpha: 0.38, midAlpha: 0.10, midStop: 75, blobAlpha: 0.22, driftMul: 1.0 },
];

const BLOBS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [ 9, 78, 14, 42, 0.55],
  [22, 72, 12, 38, 0.40],
  [38, 80, 16, 45, 0.60],
  [59, 78, 14, 42, 0.55],
  [72, 72, 12, 38, 0.40],
  [88, 80, 16, 45, 0.60],
];

function buildBackground(spec: BandSpec): string {
  const { rgb, bottomAlpha, midAlpha, midStop, blobAlpha } = spec;
  const blobLayers = BLOBS.map(([cx, cy, w, h, m]) => {
    const a = (blobAlpha * m).toFixed(3);
    return `radial-gradient(ellipse ${w}% ${h}% at ${cx}% ${cy}%, rgba(${rgb}, ${a}) 0%, rgba(${rgb}, 0) 65%)`;
  }).join(', ');
  const linear = `linear-gradient(to top, rgba(${rgb}, ${bottomAlpha}) 0%, rgba(${rgb}, ${midAlpha}) ${midStop}%, rgba(${rgb}, 0) 100%)`;
  return `${blobLayers}, ${linear}`;
}

const FOG_FLOOR = 0.1;

function buildFogMaskRaw(samples: SceneAtmosphere[]): Float32Array {
  const raw = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const atmo = samples[i];
    const isFog = atmo.conditionTier === 'fog' || atmo.fogDensityMultiplier >= FOG_FLOOR;
    if (!isFog) continue;
    raw[i] = Math.max(0, Math.min(1, atmo.fogDensityMultiplier || 1));
  }
  return raw;
}

export default function FoggyLayer() {
  const { samples48 } = useSceneWeather();

  const { maskImage, anyFog, tintGradient, dimmingGradient, direction, baseSec } =
    useMemo(() => {
      const raw = buildFogMaskRaw(samples48);
      const smoothed = smoothMask(raw);
      const maskImage = buildWhiteMaskGradient(smoothed);
      const anyFog = smoothed.some((v) => v > 0.01);

      // Wind: sample at noon (strip midpoint). Inside memo so drift duration
      // recomputes when samples48 changes.
      const noonAtmo = samples48[Math.floor(samples48.length / 2)];
      const angleRad = (noonAtmo.windVector.angleDeg * Math.PI) / 180;
      const horizontalSigned = Math.sin(angleRad) * noonAtmo.windVector.speedMps;
      const direction: 1 | -1 = horizontalSigned >= 0 ? 1 : -1;
      const baseSec = 30 / Math.max(0.5, Math.abs(horizontalSigned));

      const tintGradient = buildConditionTintGradient(samples48, 'fog');
      const dimmingGradient = buildConditionDimmingGradient(samples48, 'fog');

      return { maskImage, anyFog, tintGradient, dimmingGradient, direction, baseSec };
    }, [samples48]);

  const maskStyle: CSSProperties = {
    maskImage,
    WebkitMaskImage: maskImage,
  };

  return (
    <>
      {/* Fog-scoped tint — cool grey, multiply blend */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
        animate={{ backgroundImage: tintGradient }}
        initial={false}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {/* Fog-scoped dimming */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
        animate={{ backgroundImage: dimmingGradient }}
        initial={false}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {/* Fog bands — masked to fog x-regions, screen blend */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          mixBlendMode: 'screen',
          ...maskStyle,
        }}
        initial={false}
        animate={{ opacity: anyFog ? 1 : 0 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      >
        {BANDS.map((band, i) => (
          <FogBand
            key={i}
            spec={band}
            duration={baseSec * band.driftMul}
            direction={direction}
          />
        ))}
      </motion.div>
    </>
  );
}

interface FogBandProps {
  spec: BandSpec;
  duration: number;
  direction: 1 | -1;
}

function FogBand({ spec, duration, direction }: FogBandProps) {
  const xKeys = direction > 0 ? ['-50%', '0%'] : ['0%', '-50%'];
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: spec.height,
        overflow: 'hidden',
      }}
    >
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '200%',
          height: '100%',
          backgroundImage: buildBackground(spec),
          filter: 'blur(8px)',
          willChange: 'transform',
        }}
        animate={{ x: xKeys }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}
