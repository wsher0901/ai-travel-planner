'use client';
import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from '../SceneAtmosphere';
import {
  smoothMask,
  buildConditionTintGradient,
  buildConditionDimmingGradient,
} from '../maskUtils';
import { isRainTier } from '@/lib/weather/mapping';
import type { PrecipitationIntensity, SceneAtmosphere, WeatherCondition } from '@/lib/weather/types';

const RAIN_TIERS: ReadonlyArray<WeatherCondition> = ['light-rain', 'moderate-rain', 'heavy-rain'];

// Rain-only particle layer. Owns: cool tint (multiply) + dimming scoped to
// rain regions (light/moderate/heavy), plus canvas rain particles.
// thunderstorm and snow tiers are handled by their own layers.
// No flash-state coupling.

const INTENSITY_FACTOR: Record<PrecipitationIntensity, number> = {
  none: 0,
  light: 0.25,
  moderate: 0.6,
  heavy: 1.0,
};

interface Particle {
  x: number;
  y: number;
  length: number;
  width: number;
  speed: number;
  opacity: number;
  isFg: boolean;
  jitterPhase: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rainDims(factor: number, isFg: boolean) {
  const lengthBase = lerp(11, 25, factor);
  const widthBase  = lerp(1.5, 3, factor);
  const speedBase  = lerp(700, 1700, factor);
  const opBase     = lerp(0.4, 0.75, factor);
  const lenVar = 1 + (Math.random() * 2 - 1) * 0.15;
  const spdVar = 1 + (Math.random() * 2 - 1) * 0.15;
  const opVar  = (Math.random() * 2 - 1) * 0.1;
  return {
    length:  lengthBase * lenVar * (isFg ? 1 : 0.7),
    width:   widthBase  * (isFg ? 1 : 0.85),
    speed:   speedBase  * spdVar * (isFg ? 1 : 0.7),
    opacity: Math.max(0.1, Math.min(1, (opBase + opVar) * (isFg ? 1 : 0.55))),
  };
}

function buildRainMask(samples: SceneAtmosphere[]): Float32Array {
  const raw = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    if (isRainTier(a.conditionTier)) {
      raw[i] = INTENSITY_FACTOR[a.precipitationIntensity] || 0.6;
    }
  }
  return smoothMask(raw);
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
  const segStart = cdf[lo];
  const segMass  = cdf[lo + 1] - segStart;
  const segR     = segMass > 0 ? (r - segStart) / segMass : Math.random();
  return ((lo + segR) / (cdf.length - 1)) * cssW;
}

function baseCountFor(maxFactor: number): number {
  if (maxFactor <= 0.25) return 30;
  if (maxFactor <= 0.6)  return 60;
  return 120;
}

export default function RainLayer() {
  const { samples48 } = useSceneWeather();

  const { mask, cdf, totalMass, maxFactor, tintGradient, dimmingGradient } =
    useMemo(() => {
      const m = buildRainMask(samples48);
      const c = buildCDF(m);
      let mx = 0;
      for (let i = 0; i < m.length; i++) if (m[i] > mx) mx = m[i];
      return {
        mask: m,
        cdf: c,
        totalMass: c[c.length - 1],
        maxFactor: mx,
        tintGradient: buildConditionTintGradient(samples48, RAIN_TIERS),
        dimmingGradient: buildConditionDimmingGradient(samples48, RAIN_TIERS),
      };
    }, [samples48]);

  const visible = totalMass > 0.05;

  const samplesRef   = useRef<SceneAtmosphere[]>(samples48);
  const cdfRef       = useRef<Float32Array>(cdf);
  const totalRef     = useRef<number>(totalMass);
  const maxRef       = useRef<number>(maxFactor);
  samplesRef.current = samples48;
  cdfRef.current     = cdf;
  totalRef.current   = totalMass;
  maxRef.current     = maxFactor;
  void mask;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

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
      canvas.width  = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width  = `${cssW}px`;
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
      const c = cdfRef.current;
      if (!c || c.length < 2) return 0;
      const total = totalRef.current;
      const fraction = total / (c.length - 1);
      return Math.round(baseCountFor(maxRef.current) * fraction);
    };

    const spawn = (initial: boolean): Particle | null => {
      if (totalRef.current <= 0) return null;
      const x = sampleWeightedX(cdfRef.current, totalRef.current, cssW);
      const samples = samplesRef.current;
      const idx = Math.min(samples.length - 1, Math.max(0, Math.floor((x / cssW) * samples.length)));
      const atmo   = samples[idx];
      const factor = INTENSITY_FACTOR[atmo.precipitationIntensity] || 0.6;
      const isFg   = Math.random() < 0.7;
      const dims   = rainDims(factor, isFg);
      return {
        x,
        y: initial ? Math.random() * cssH : -dims.length,
        length:       dims.length,
        width:        dims.width,
        speed:        dims.speed,
        opacity:      dims.opacity,
        isFg,
        jitterPhase:  Math.random() * Math.PI * 2,
      };
    };

    { const tc = targetCount(); while (particles.length < tc) { const p = spawn(true); if (!p) break; particles.push(p); } }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      const samples = samplesRef.current;
      const tc      = targetCount();

      if (totalRef.current > 0 && particles.length < tc) {
        const toAdd = Math.min(tc - particles.length, 4);
        for (let k = 0; k < toAdd; k++) { const p = spawn(false); if (p) particles.push(p); }
      }

      ctx.clearRect(0, 0, cssW, cssH);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        const sIdx = Math.min(samples.length - 1, Math.max(0, Math.floor((p.x / cssW) * samples.length)));
        const w    = samples[sIdx].windVector;
        const windVx = Math.sin((w.angleDeg * Math.PI) / 180) * w.speedMps * 8;
        let vx = windVx;
        if (p.speed > 1300) vx += Math.sin(now / 200 + p.jitterPhase) * 5;

        p.x += vx * dt;
        p.y += p.speed * dt;

        if (p.y > cssH + p.length) {
          if (totalRef.current > 0 && particles.length <= tc * 1.2) {
            const r = spawn(false);
            if (r) { particles[i] = r; continue; }
          }
          particles.splice(i, 1);
          continue;
        }
        if (p.x < -p.length) p.x = cssW + p.length;
        else if (p.x > cssW + p.length) p.x = -p.length;

        ctx.strokeStyle = `rgba(180, 195, 220, ${p.opacity.toFixed(3)})`;
        ctx.lineWidth   = p.width;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - vx * 0.02, p.y - p.length);
        ctx.stroke();
      }
    };

    raf = requestAnimationFrame((t) => { lastT = t; tick(t); });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      {/* Rain-scoped tint — cool blue-grey, multiply blend */}
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
      {/* Rain-scoped dimming */}
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
      {/* Rain particle canvas */}
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
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </motion.div>
    </>
  );
}
