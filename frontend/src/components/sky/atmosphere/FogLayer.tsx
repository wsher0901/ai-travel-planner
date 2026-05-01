'use client';
import { useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';
import { sampleIndexToPercent } from '@/lib/weather/spatial';
import type { SceneAtmosphere } from '@/lib/weather/types';

// 3-band stacked fog. Bands are 200% wide and translate from 0% → -50%
// (or reverse for opposite wind) for seamless tiled drift. Linear gradient
// gives vertical density falloff; radial blobs give horizontal variation
// so the drift is actually visible.
//
// 3B: bands span the full strip, but a CSS mask-image clips them to
// x-regions where atmosphere(x).fogDensityMultiplier > 0 (or tier='fog').
// Wrapper opacity fades when no fog exists anywhere on the day so the
// layer fully retires on clear days.

interface BandSpec {
  height: string;
  rgb: string;
  bottomAlpha: number;
  midAlpha: number;
  midStop: number;
  blobAlpha: number;
  driftMul: number; // back bands slower
}

const BANDS: BandSpec[] = [
  { height: '65%', rgb: '200, 210, 225', bottomAlpha: 0.18, midAlpha: 0.04, midStop: 60, blobAlpha: 0.10, driftMul: 2.4 }, // back
  { height: '45%', rgb: '210, 215, 230', bottomAlpha: 0.28, midAlpha: 0.06, midStop: 70, blobAlpha: 0.16, driftMul: 1.6 }, // mid
  { height: '30%', rgb: '220, 225, 240', bottomAlpha: 0.38, midAlpha: 0.10, midStop: 75, blobAlpha: 0.22, driftMul: 1.0 }, // front
];

const BLOBS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [9,  78, 14, 42, 0.55],
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

const FOG_FLOOR = 0.1; // below this density we treat the hour as fog-free

// Per-x mask alpha. Smoothed via 3-tap moving average to soften
// region-edge cuts (each native sample is already 30 min wide, the
// smoothing layers another ±30 min of feather).
function buildFogMask(samples: SceneAtmosphere[]): number[] {
  const raw = samples.map((atmo) => {
    const isFogRegion = atmo.conditionTier === 'fog' || atmo.fogDensityMultiplier >= FOG_FLOOR;
    if (!isFogRegion) return 0;
    return Math.max(0, Math.min(1, atmo.fogDensityMultiplier || 1));
  });
  const smoothed = new Array<number>(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(raw.length - 1, i + 1)];
    smoothed[i] = (a + b + c) / 3;
  }
  return smoothed;
}

function buildMaskImage(mask: number[]): string {
  // White-with-alpha so the mask works in both alpha-mode and the legacy
  // luminance-mode default (older Safari): white * alpha ≈ alpha for both.
  const parts: string[] = [];
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i].toFixed(3);
    const pct = sampleIndexToPercent(i, mask.length).toFixed(3);
    parts.push(`rgba(255, 255, 255, ${a}) ${pct}%`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

export default function FogLayer() {
  const { samples48 } = useSceneWeather();

  // Wind drives drift. 3B spec: sample at the band's center x (= strip
  // midpoint = noon). One direction/speed for all bands keeps the drift
  // coherent across stacked layers.
  const noonAtmo = samples48[Math.floor(samples48.length / 2)];
  const angleRad = (noonAtmo.windVector.angleDeg * Math.PI) / 180;
  const horizontalSigned = Math.sin(angleRad) * noonAtmo.windVector.speedMps;
  const direction: 1 | -1 = horizontalSigned >= 0 ? 1 : -1;
  const horizontalAbs = Math.max(0.5, Math.abs(horizontalSigned));
  const baseSec = 30 / horizontalAbs;

  const { maskImage, anyFog } = useMemo(() => {
    const mask = buildFogMask(samples48);
    return {
      maskImage: buildMaskImage(mask),
      anyFog: mask.some((v) => v > 0.01),
    };
  }, [samples48]);

  // White-with-alpha mask works in both alpha- and luminance-mode browsers,
  // so we don't need to set mask-mode explicitly. WebkitMaskImage covers
  // older Safari that still requires the prefix.
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
