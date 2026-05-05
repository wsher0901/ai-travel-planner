'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { useSceneWeather } from '../SceneAtmosphere';
import {
  smoothMask,
  buildWhiteMaskGradient,
  buildConditionTintGradient,
  buildConditionDimmingGradient,
} from '../maskUtils';
import {
  getLightningFlashActive,
  setLightningFlashActive,
} from '../lightningFlashState';
import type { PrecipitationIntensity, SceneAtmosphere } from '@/lib/weather/types';

// Storm-only layer. Owns: cool tint (multiply) + heavy dimming scoped to
// storm regions, rain particles (reads flash state for particle colour),
// lightning flash div, and gust streaks (Prompt 5).
// ONLY this layer reads/writes lightningFlashState — RainLayer is isolated.

// Storm rain density target (Prompt 5 spec): ~60 particles per 100% storm
// coverage. Replaces the prior tier-conditional baseCountFor() so the
// thunderstorm reads denser than heavy-rain (50) but doesn't double up
// when baseCountFor maxed at 120.
const STORM_RAIN_DENSITY = 60;

// Gust spike scheduling — random 4–9 s between bursts. The CSS animation
// (`gustBurst` in globals.css) runs for exactly 600 ms; the unmount timer
// fires at 650 ms so JS timer imprecision can't unmount the streak before
// its fade-out keyframe completes.
const GUST_DELAY_MIN = 4000;
const GUST_DELAY_RANGE = 5000;
const GUST_DURATION_MS = 650;

// Pre-authored gust streaks. 4 horizontal-leaning lines at varied y. Length
// is in viewBox-x units (8–20 units = ~80–120 px on a 600-wide strip).
interface GustStreak {
  x1: number;
  y: number;
  length: number;
}
const GUST_STREAKS: ReadonlyArray<GustStreak> = [
  { x1:  6, y: 24, length: 18 },
  { x1: 58, y: 41, length: 14 },
  { x1: 28, y: 60, length: 20 },
  { x1: 73, y: 78, length: 13 },
];
const GUST_STROKE = 'rgba(220, 230, 240, 0.35)';

const INTENSITY_FACTOR: Record<PrecipitationIntensity, number> = {
  none: 0,
  light: 0.25,
  moderate: 0.6,
  heavy: 1.0,
};

const FLASH_DURATION_S  = 0.380;
const FLASH_OPACITIES   = [0, 0.55, 0, 0.75, 0.25, 0] as const;
const FLASH_TIMES       = [0, 60 / 380, 100 / 380, 180 / 380, 280 / 380, 1] as const;
const MIN_INTERVAL_MS   = 8000;
const MAX_INTERVAL_MS   = 12000;
const FIRST_FLASH_MIN   = 1500;
const FIRST_FLASH_MAX   = 3500;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

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

function buildStormParticleMask(samples: SceneAtmosphere[]): Float32Array {
  const raw = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    if (a.conditionTier === 'thunderstorm') {
      raw[i] = INTENSITY_FACTOR[a.precipitationIntensity] || 0.6;
    }
  }
  return smoothMask(raw);
}

function buildLightningMask(samples: SceneAtmosphere[]): { image: string; anyStorm: boolean } {
  const raw = new Float32Array(samples.length);
  let anyStorm = false;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].conditionTier === 'thunderstorm') { raw[i] = 1; anyStorm = true; }
  }
  if (!anyStorm) {
    return {
      image: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 100%)',
      anyStorm: false,
    };
  }
  return { image: buildWhiteMaskGradient(smoothMask(raw)), anyStorm: true };
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

export default function StormLayer() {
  const { samples48, atmosphere } = useSceneWeather();
  const isStorm = atmosphere.conditionTier === 'thunderstorm';

  const { mask, cdf, totalMass, flashMask, anyStorm, tintGradient, dimmingGradient } =
    useMemo(() => {
      const m  = buildStormParticleMask(samples48);
      const c  = buildCDF(m);
      const { image: flashMask, anyStorm } = buildLightningMask(samples48);
      return {
        mask: m,
        cdf: c,
        totalMass:      c[c.length - 1],
        flashMask,
        anyStorm,
        tintGradient:    buildConditionTintGradient(samples48, 'thunderstorm'),
        dimmingGradient: buildConditionDimmingGradient(samples48, 'thunderstorm'),
      };
    }, [samples48]);

  const visible = totalMass > 0.05;

  const samplesRef   = useRef<SceneAtmosphere[]>(samples48);
  const cdfRef       = useRef<Float32Array>(cdf);
  const totalRef     = useRef<number>(totalMass);
  samplesRef.current = samples48;
  cdfRef.current     = cdf;
  totalRef.current   = totalMass;
  void mask;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  // --- Particle canvas ---
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
      // Density is proportional to storm coverage: full-strip storm → 60
      // particles; half-strip → 30; etc.
      return Math.round(STORM_RAIN_DENSITY * (totalRef.current / (c.length - 1)));
    };

    const spawn = (initial: boolean): Particle | null => {
      if (totalRef.current <= 0) return null;
      const x      = sampleWeightedX(cdfRef.current, totalRef.current, cssW);
      const samples = samplesRef.current;
      const idx    = Math.min(samples.length - 1, Math.max(0, Math.floor((x / cssW) * samples.length)));
      const factor = INTENSITY_FACTOR[samples[idx].precipitationIntensity] || 0.6;
      const isFg   = Math.random() < 0.7;
      const dims   = rainDims(factor, isFg);
      return {
        x,
        y: initial ? Math.random() * cssH : -dims.length,
        length:      dims.length,
        width:       dims.width,
        speed:       dims.speed,
        opacity:     dims.opacity,
        isFg,
        jitterPhase: Math.random() * Math.PI * 2,
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

      // Flash state drives particle colour — only StormLayer reads this.
      const flash    = getLightningFlashActive();
      const rainCol  = flash ? 'rgba(220, 230, 245, ' : 'rgba(180, 195, 220, ';

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

        ctx.strokeStyle = rainCol + p.opacity.toFixed(3) + ')';
        ctx.lineWidth   = p.width;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - vx * 0.02, p.y - p.length);
        ctx.stroke();
      }
    };

    raf = requestAnimationFrame((t) => { lastT = t; tick(t); });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // --- Lightning flash scheduling ---
  const controls = useAnimationControls();

  useEffect(() => {
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
        // Animation interrupted by unmount or mask change. Ignored.
      }
      if (cancelled) return;
      setLightningFlashActive(false);
      timeoutId = window.setTimeout(triggerFlash, randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS));
    };

    timeoutId = window.setTimeout(triggerFlash, randomBetween(FIRST_FLASH_MIN, FIRST_FLASH_MAX));

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      setLightningFlashActive(false);
      controls.stop();
      controls.set({ opacity: 0 });
    };
  }, [anyStorm, controls]);

  // --- Gust spike scheduling ---
  // Wind streaks fire on a random 4–9 s timer, each burst lasts 600 ms.
  // Two-phase loop (idle → burst start → 600 ms → burst end → next idle)
  // tracked through a single `timerId` and a `cancelled` flag so unmount
  // or tier change can't race a stale callback into setState.
  const [gustActive, setGustActive] = useState(false);
  useEffect(() => {
    if (!isStorm) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const delay = GUST_DELAY_MIN + Math.random() * GUST_DELAY_RANGE;
      timerId = setTimeout(() => {
        if (cancelled) return;
        setGustActive(true);
        timerId = setTimeout(() => {
          if (cancelled) return;
          setGustActive(false);
          schedule();
        }, GUST_DURATION_MS);
      }, delay);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
      setGustActive(false);
    };
  }, [isStorm]);

  const flashMaskStyle: CSSProperties = {
    maskImage: flashMask,
    WebkitMaskImage: flashMask,
  };

  return (
    <>
      {/* Storm-scoped tint — deep blue-grey, multiply blend */}
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
      {/* Storm-scoped dimming */}
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
      {/* Storm rain particles */}
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
      {/* Lightning flash — screen blend, masked to storm x-regions */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundColor: 'rgb(230, 240, 255)',
          mixBlendMode: 'screen',
          ...flashMaskStyle,
        }}
        initial={{ opacity: 0 }}
        animate={controls}
      />
      {/* Gust spikes — fade-in/slide/fade-out streaks scoped to thunderstorm
          x-regions via the same mask the lightning flash uses (asymmetric
          ramp from buildWhiteMaskGradient, mirrored 45 min lead-in / 15 min
          lead-out). isStorm gates the BURST trigger; flashMask gates SPATIAL
          visibility — outside thunderstorm hours the mask is alpha-0 so
          gust streaks are invisible regardless of gustActive. */}
      {gustActive && isStorm && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            maskImage: flashMask,
            WebkitMaskImage: flashMask,
          }}
        >
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <g className="sky-gust-burst">
              {GUST_STREAKS.map((s, i) => (
                <line
                  key={i}
                  x1={s.x1}
                  y1={s.y}
                  x2={s.x1 + s.length}
                  y2={s.y}
                  stroke={GUST_STROKE}
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              ))}
            </g>
          </svg>
        </div>
      )}
    </>
  );
}
