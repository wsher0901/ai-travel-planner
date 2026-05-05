'use client';
import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSceneWeather } from '../SceneAtmosphere';
import { smoothMask } from '../maskUtils';
import { isSnowTier } from '@/lib/weather/mapping';
import type { PrecipitationIntensity, SceneAtmosphere } from '@/lib/weather/types';

// Snow-only particle layer. Particles only — no tint/dimming (Prompt 5).
// Tier mask = light-snow / moderate-snow / heavy-snow.

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
  swayPhase: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function snowDims(factor: number, isFg: boolean) {
  const widthBase = lerp(1.8, 3.5, factor);
  const speedBase = lerp(160, 360, factor);
  const opBase    = lerp(0.55, 0.85, factor);
  return {
    length:  lerp(3, 6, factor),
    width:   widthBase * (isFg ? 1 : 0.8),
    speed:   speedBase * (Math.random() * 0.4 + 0.8) * (isFg ? 1 : 0.7),
    opacity: Math.max(0.2, Math.min(1, (opBase + (Math.random() - 0.5) * 0.15) * (isFg ? 1 : 0.6))),
  };
}

function buildSnowMask(samples: SceneAtmosphere[]): Float32Array {
  const raw = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    if (isSnowTier(a.conditionTier)) {
      raw[i] = INTENSITY_FACTOR[a.precipitationIntensity] || 0.6;
    }
  }
  return smoothMask(raw);
}

function buildCDF(mask: Float32Array): Float32Array {
  const cdf = new Float32Array(mask.length + 1);
  let acc = 0;
  for (let i = 0; i < mask.length; i++) { acc += mask[i]; cdf[i + 1] = acc; }
  return cdf;
}

function sampleWeightedX(cdf: Float32Array, total: number, cssW: number): number {
  if (total <= 0) return Math.random() * cssW;
  const r = Math.random() * total;
  let lo = 0, hi = cdf.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid + 1] <= r) lo = mid + 1; else hi = mid;
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

export default function SnowLayer() {
  const { samples48 } = useSceneWeather();

  const { mask, cdf, totalMass, maxFactor } = useMemo(() => {
    const m = buildSnowMask(samples48);
    const c = buildCDF(m);
    let mx = 0;
    for (let i = 0; i < m.length; i++) if (m[i] > mx) mx = m[i];
    return { mask: m, cdf: c, totalMass: c[c.length - 1], maxFactor: mx };
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
    let cssW = 1, cssH = 1;
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
      return Math.round(baseCountFor(maxRef.current) * (totalRef.current / (c.length - 1)));
    };

    const spawn = (initial: boolean): Particle | null => {
      if (totalRef.current <= 0) return null;
      const x = sampleWeightedX(cdfRef.current, totalRef.current, cssW);
      const samples = samplesRef.current;
      const idx    = Math.min(samples.length - 1, Math.max(0, Math.floor((x / cssW) * samples.length)));
      const factor = INTENSITY_FACTOR[samples[idx].precipitationIntensity] || 0.6;
      const isFg   = Math.random() < 0.7;
      const dims   = snowDims(factor, isFg);
      return {
        x,
        y: initial ? Math.random() * cssH : -dims.length,
        length:     dims.length,
        width:      dims.width,
        speed:      dims.speed,
        opacity:    dims.opacity,
        isFg,
        swayPhase:  Math.random() * Math.PI * 2,
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
        const vx = windVx * 0.5 + Math.sin(now / 600 + p.swayPhase) * 18;

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

        ctx.fillStyle = `rgba(225, 232, 245, ${p.opacity.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame((t) => { lastT = t; tick(t); });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
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
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    </motion.div>
  );
}
