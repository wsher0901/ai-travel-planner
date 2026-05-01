'use client';
import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from './SceneAtmosphere';
import { getLightningFlashActive } from './lightningFlashState';
import type {
  PrecipitationIntensity,
  SceneAtmosphere,
} from '@/lib/weather/types';

// 3B horizontal mapping: particles only spawn within rainy/snowy x-regions
// of the strip. xRainMask[i] holds the local intensity factor at sample i;
// inverse-CDF sampling gives a cheap weighted spawn x. Each particle picks
// its mode (rain vs snow) at spawn from the tier at its spawn x and keeps
// it for life. Wind is sampled at the particle's current x each frame so
// morning/afternoon wind direction differences are visible.

const INTENSITY_FACTOR: Record<PrecipitationIntensity, number> = {
  none: 0,
  light: 0.25,
  moderate: 0.6,
  heavy: 1.0,
};

interface Particle {
  mode: 'rain' | 'snow';
  x: number;
  y: number;
  length: number;
  width: number;
  speed: number;
  opacity: number;
  isFg: boolean;
  jitterPhase: number;
  swayPhase: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rainDims(factor: number, isFg: boolean) {
  const lengthBase = lerp(11, 25, factor);
  const widthBase  = lerp(1.5, 3,  factor);
  const speedBase  = lerp(700, 1700, factor);
  const opBase     = lerp(0.4, 0.75, factor);
  const lenVar = 1 + (Math.random() * 2 - 1) * 0.15;
  const spdVar = 1 + (Math.random() * 2 - 1) * 0.15;
  const opVar = (Math.random() * 2 - 1) * 0.1;
  return {
    length: lengthBase * lenVar * (isFg ? 1 : 0.7),
    width:  widthBase * (isFg ? 1 : 0.85),
    speed:  speedBase * spdVar * (isFg ? 1 : 0.7),
    opacity: Math.max(0.1, Math.min(1, (opBase + opVar) * (isFg ? 1 : 0.55))),
  };
}

function snowDims(factor: number, isFg: boolean) {
  const widthBase = lerp(1.8, 3.5, factor);
  const speedBase = lerp(160, 360, factor);
  const opBase    = lerp(0.55, 0.85, factor);
  return {
    length: lerp(3, 6, factor),
    width:  widthBase * (isFg ? 1 : 0.8),
    speed:  speedBase * (Math.random() * 0.4 + 0.8) * (isFg ? 1 : 0.7),
    opacity: Math.max(0.2, Math.min(1,
      (opBase + (Math.random() - 0.5) * 0.15) * (isFg ? 1 : 0.6))),
  };
}

function buildXRainMask(samples: SceneAtmosphere[]): Float32Array {
  const raw = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    if (a.conditionTier === 'rain' || a.conditionTier === 'storm' || a.conditionTier === 'snow') {
      raw[i] = INTENSITY_FACTOR[a.precipitationIntensity] || 0.6;
    }
  }
  // 3-tap smoothing so region-edge transitions span ~30 min instead of snapping.
  const smoothed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(samples.length - 1, i + 1)];
    smoothed[i] = (a + b + c) / 3;
  }
  return smoothed;
}

function buildCDF(mask: Float32Array): Float32Array {
  const cdf = new Float32Array(mask.length + 1);
  let acc = 0;
  for (let i = 0; i < mask.length; i++) {
    acc += mask[i];
    cdf[i + 1] = acc;
  }
  return cdf;
}

// Inverse-CDF sample → weighted random x in [0, cssW). Binary-search keeps
// per-spawn cost at O(log N) where N=48. Sub-segment interpolation gives
// finer x granularity than the 30-min sample boundaries would alone.
function sampleWeightedX(cdf: Float32Array, total: number, cssW: number): number {
  if (total <= 0) return Math.random() * cssW;
  const r = Math.random() * total;
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid + 1] <= r) lo = mid + 1;
    else hi = mid;
  }
  const idx = lo;
  const segStart = cdf[idx];
  const segMass = cdf[idx + 1] - segStart;
  const segR = segMass > 0 ? (r - segStart) / segMass : Math.random();
  const xFraction = (idx + segR) / (cdf.length - 1);
  return xFraction * cssW;
}

// Map dominant intensity factor → base particle count.
function baseCountFor(maxFactor: number): number {
  if (maxFactor <= 0.25) return 30;
  if (maxFactor <= 0.6)  return 60;
  return 120;
}

export default function RainField() {
  const { samples48 } = useSceneWeather();

  const { mask, cdf, totalMass, maxFactor } = useMemo(() => {
    const m = buildXRainMask(samples48);
    const c = buildCDF(m);
    let mx = 0;
    for (let i = 0; i < m.length; i++) if (m[i] > mx) mx = m[i];
    return { mask: m, cdf: c, totalMass: c[c.length - 1], maxFactor: mx };
  }, [samples48]);

  const visible = totalMass > 0.05;

  // Live refs so the rAF loop sees latest values without restarting
  // (restart would freeze particles mid-fall).
  const samplesRef = useRef<SceneAtmosphere[]>(samples48);
  const cdfRef = useRef<Float32Array>(cdf);
  const totalMassRef = useRef<number>(totalMass);
  const maxFactorRef = useRef<number>(maxFactor);
  samplesRef.current = samples48;
  cdfRef.current = cdf;
  totalMassRef.current = totalMass;
  maxFactorRef.current = maxFactor;
  void mask; // mask referenced via cdf indirectly; kept named for readability

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let cssW = 1;
    let cssH = 1;
    let particles: Particle[] = [];
    let raf = 0;
    let lastT = performance.now();

    const fitCanvas = () => {
      const rect = container.getBoundingClientRect();
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
    };

    fitCanvas();

    const ro = new ResizeObserver(() => {
      fitCanvas();
      for (const p of particles) {
        if (p.x < -50 || p.x > cssW + 50) p.x = Math.random() * cssW;
        if (p.y < -50 || p.y > cssH + 50) p.y = Math.random() * cssH;
      }
    });
    ro.observe(container);

    const targetCount = (): number => {
      const cdfArr = cdfRef.current;
      if (!cdfArr || cdfArr.length < 2) return 0;
      const total = totalMassRef.current;
      const len = cdfArr.length - 1;
      const fraction = total / len; // average mass per sample, 0..1
      return Math.round(baseCountFor(maxFactorRef.current) * fraction);
    };

    const spawn = (initial: boolean): Particle | null => {
      if (totalMassRef.current <= 0) return null;
      const x = sampleWeightedX(cdfRef.current, totalMassRef.current, cssW);
      const samples = samplesRef.current;
      const idx = Math.min(samples.length - 1, Math.max(0, Math.floor((x / cssW) * samples.length)));
      const atmo = samples[idx];
      const factor = INTENSITY_FACTOR[atmo.precipitationIntensity] || 0.6;
      const mode: 'rain' | 'snow' = atmo.conditionTier === 'snow' ? 'snow' : 'rain';
      const isFg = Math.random() < 0.7;
      const dims = mode === 'snow' ? snowDims(factor, isFg) : rainDims(factor, isFg);
      return {
        mode,
        x,
        y: initial ? Math.random() * cssH : -dims.length,
        length: dims.length,
        width: dims.width,
        speed: dims.speed,
        opacity: dims.opacity,
        isFg,
        jitterPhase: Math.random() * Math.PI * 2,
        swayPhase: Math.random() * Math.PI * 2,
      };
    };

    // Initial seed.
    {
      const tc = targetCount();
      while (particles.length < tc) {
        const p = spawn(true);
        if (!p) break;
        particles.push(p);
      }
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const samples = samplesRef.current;
      const tc = targetCount();

      // Top up gradually if mass increased or particles drained.
      if (totalMassRef.current > 0 && particles.length < tc) {
        const toAdd = Math.min(tc - particles.length, 4);
        for (let k = 0; k < toAdd; k++) {
          const p = spawn(false);
          if (p) particles.push(p);
        }
      }

      const flash = getLightningFlashActive();

      ctx.clearRect(0, 0, cssW, cssH);

      const rainCol = flash ? 'rgba(220, 230, 245, ' : 'rgba(180, 195, 220, ';
      const snowCol = flash ? 'rgba(245, 250, 255, ' : 'rgba(225, 232, 245, ';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Per-particle wind so morning/afternoon wind direction differences
        // are visible across the strip.
        const sIdx = Math.min(samples.length - 1, Math.max(0, Math.floor((p.x / cssW) * samples.length)));
        const w = samples[sIdx].windVector;
        const windVx = Math.sin((w.angleDeg * Math.PI) / 180) * w.speedMps * 8;

        let vx: number;
        if (p.mode === 'rain') {
          vx = windVx;
          if (p.speed > 1300) vx += Math.sin(now / 200 + p.jitterPhase) * 5;
        } else {
          vx = windVx * 0.5 + Math.sin(now / 600 + p.swayPhase) * 18;
        }

        p.x += vx * dt;
        p.y += p.speed * dt;

        if (p.y > cssH + p.length) {
          // Try to respawn (only if there's still mass to spawn into).
          if (totalMassRef.current > 0 && particles.length <= tc * 1.2) {
            const r = spawn(false);
            if (r) {
              particles[i] = r;
              continue;
            }
          }
          particles.splice(i, 1);
          continue;
        }

        if (p.x < -p.length) p.x = cssW + p.length;
        else if (p.x > cssW + p.length) p.x = -p.length;

        if (p.mode === 'rain') {
          ctx.strokeStyle = rainCol + p.opacity.toFixed(3) + ')';
          ctx.lineWidth = p.width;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - vx * 0.02, p.y - p.length);
          ctx.stroke();
        } else {
          ctx.fillStyle = snowCol + p.opacity.toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.width, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    raf = requestAnimationFrame((t) => {
      lastT = t;
      tick(t);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <motion.div
      ref={containerRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </motion.div>
  );
}
