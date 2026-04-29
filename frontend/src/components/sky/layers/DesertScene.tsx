'use client';
import { useId, useMemo } from 'react';
import { mulberry32 } from '@/lib/prng';

// Smooth quadratic Bezier dune path. Control points above the endpoints
// create rounded dune crests — distinguishes desert from mountain's jagged peaks.
function genDunePath(
  seed: number,
  baselineY: number,
  minY: number,
  maxY: number,
  dunes: number,
): string {
  const rng = mulberry32(seed);
  const stepX = 1000 / dunes;
  let prevY = minY + rng() * (maxY - minY);
  let d = `M 0 ${baselineY} L 0 ${prevY.toFixed(2)}`;
  for (let i = 1; i <= dunes; i++) {
    const x = i * stepX;
    const y = minY + rng() * (maxY - minY);
    const ctrlX = x - stepX / 2;
    const ctrlY = Math.max((prevY + y) / 2 - 4 - rng() * 6, minY);
    d += ` Q ${ctrlX.toFixed(2)} ${ctrlY.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    prevY = y;
  }
  d += ` L 1000 ${baselineY} Z`;
  return d;
}

interface Mesa {
  x: number;
  y: number;
  width: number;
  height: number;
}

function genMesas(seed: number): Mesa[] {
  const rng = mulberry32(seed);
  return [
    {
      x: 80 + rng() * 300,
      y: 146 + rng() * 8,
      width: 55 + rng() * 60,
      height: 11 + rng() * 7,
    },
    {
      x: 520 + rng() * 300,
      y: 147 + rng() * 8,
      width: 50 + rng() * 55,
      height: 10 + rng() * 7,
    },
  ];
}

function buildMesaPath({ x, y, width, height }: Mesa): string {
  const taper = width * 0.05;
  return (
    `M ${x.toFixed(1)} ${(y + height).toFixed(1)}` +
    ` L ${(x + taper).toFixed(1)} ${y.toFixed(1)}` +
    ` L ${(x + width - taper).toFixed(1)} ${y.toFixed(1)}` +
    ` L ${(x + width).toFixed(1)} ${(y + height).toFixed(1)} Z`
  );
}

// Compound path for a saguaro silhouette: trunk + left arm + right arm.
// Arms branch horizontally from the trunk then turn upward.
function buildCactusPath(
  cx: number,
  baseY: number,
  trunkH: number,
  armHLen: number,
  armVLen: number,
): string {
  const trunkW = 3.2;
  const armW = 2.6;
  const tx1 = cx - trunkW / 2;
  const tx2 = cx + trunkW / 2;
  const tipY = baseY - trunkH;

  // Left arm — branches at ~44% of trunk height from base
  const laY1 = baseY - trunkH * 0.44;
  const laY2 = laY1 + armW;
  const laExtX = tx1 - armHLen;
  const laTopY = laY1 - armVLen;

  // Right arm — slightly lower branch point for natural asymmetry
  const raY2 = baseY - trunkH * 0.36;
  const raY1 = raY2 - armW;
  const raExtX = tx2 + armHLen;
  const raTopY = raY1 - armVLen;

  // Trunk
  let d = `M ${tx1.toFixed(1)} ${baseY}`;
  d += ` L ${tx1.toFixed(1)} ${tipY.toFixed(1)}`;
  d += ` L ${tx2.toFixed(1)} ${tipY.toFixed(1)}`;
  d += ` L ${tx2.toFixed(1)} ${baseY} Z`;

  // Left arm: go left then up
  d += ` M ${tx1.toFixed(1)} ${laY2.toFixed(1)}`;
  d += ` L ${laExtX.toFixed(1)} ${laY2.toFixed(1)}`;
  d += ` L ${laExtX.toFixed(1)} ${laTopY.toFixed(1)}`;
  d += ` L ${(laExtX + armW).toFixed(1)} ${laTopY.toFixed(1)}`;
  d += ` L ${(laExtX + armW).toFixed(1)} ${laY1.toFixed(1)}`;
  d += ` L ${tx1.toFixed(1)} ${laY1.toFixed(1)} Z`;

  // Right arm: go right then up — start at bottom of junction (raY2), inner side returns to top (raY1)
  d += ` M ${tx2.toFixed(1)} ${raY2.toFixed(1)}`;
  d += ` L ${raExtX.toFixed(1)} ${raY2.toFixed(1)}`;
  d += ` L ${raExtX.toFixed(1)} ${raTopY.toFixed(1)}`;
  d += ` L ${(raExtX - armW).toFixed(1)} ${raTopY.toFixed(1)}`;
  d += ` L ${(raExtX - armW).toFixed(1)} ${raY1.toFixed(1)}`;
  d += ` L ${tx2.toFixed(1)} ${raY1.toFixed(1)} Z`;

  return d;
}

interface CactusData {
  cx: number;
  baseY: number;
  trunkH: number;
  armHLen: number;
  armVLen: number;
}

function genCacti(seed: number): CactusData[] {
  const rng = mulberry32(seed);
  return [
    {
      cx: 150 + rng() * 120,
      baseY: 187 + rng() * 4,
      trunkH: 17 + rng() * 6,
      armHLen: 9 + rng() * 5,
      armVLen: 10 + rng() * 5,
    },
    {
      cx: 700 + rng() * 140,
      baseY: 185 + rng() * 5,
      trunkH: 18 + rng() * 6,
      armHLen: 10 + rng() * 5,
      armVLen: 10 + rng() * 5,
    },
  ];
}

interface ScrubDot {
  x: number;
  y: number;
  h: number;
}

function genScrubDots(seed: number): ScrubDot[] {
  const rng = mulberry32(seed);
  return Array.from({ length: 10 }, () => ({
    x: rng() * 1000,
    y: 177 + rng() * 6,
    h: 1 + rng() * 1.5,
  }));
}

export default function DesertScene() {
  const uid = useId().replace(/:/g, '');
  const farId = `desert-far-${uid}`;
  const mesaId = `desert-mesa-${uid}`;
  const midId = `desert-mid-${uid}`;
  const frontId = `desert-front-${uid}`;
  const sandId = `desert-sand-${uid}`;
  const hazeId = `desert-haze-${uid}`;

  const farPath = useMemo(() => genDunePath(50, 200, 140, 154, 8), []);
  const mesas = useMemo(() => genMesas(51), []);
  const midPath = useMemo(() => genDunePath(52, 200, 158, 172, 7), []);
  const frontPath = useMemo(() => genDunePath(55, 200, 172, 184, 6), []);
  const cacti = useMemo(() => genCacti(53), []);
  const scrubDots = useMemo(() => genScrubDots(54), []);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={farId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#786a55" />
          <stop offset="100%" stopColor="#58503e" />
        </linearGradient>
        <linearGradient id={mesaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#58503e" />
          <stop offset="100%" stopColor="#3e3826" />
        </linearGradient>
        <linearGradient id={midId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#58503e" />
          <stop offset="100%" stopColor="#3e3826" />
        </linearGradient>
        <linearGradient id={frontId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3e3826" />
          <stop offset="100%" stopColor="#2a2418" />
        </linearGradient>
        <linearGradient id={sandId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2418" />
          <stop offset="100%" stopColor="#1a1612" />
        </linearGradient>
        <filter id={hazeId} x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Layer 1: far horizon — blurred haze, lightest warm-tan */}
      <path
        d={farPath}
        fill={`url(#${farId})`}
        opacity="0.55"
        filter={`url(#${hazeId})`}
      />

      {/* Layer 2: mesa formations — flat-topped rocky buttes */}
      {mesas.map((m, i) => (
        <path
          key={`mesa-${i}`}
          d={buildMesaPath(m)}
          fill={`url(#${mesaId})`}
          opacity="0.7"
        />
      ))}

      {/* Layer 3: mid dunes — smooth Bezier curves, warm taupe */}
      <path d={midPath} fill={`url(#${midId})`} opacity="0.7" />

      {/* Layer 4: front dunes — closer, more pronounced */}
      <path d={frontPath} fill={`url(#${frontId})`} opacity="0.82" />

      {/* Sparse scrubland — barely-visible vertical strokes on dune surface */}
      {scrubDots.map((dot, i) => (
        <line
          key={`scrub-${i}`}
          x1={dot.x.toFixed(2)}
          y1={dot.y.toFixed(2)}
          x2={dot.x.toFixed(2)}
          y2={(dot.y - dot.h).toFixed(2)}
          stroke="#2a2418"
          strokeWidth="0.4"
          opacity="0.5"
        />
      ))}

      {/* Foreground sand band */}
      <rect
        x="0"
        y="188"
        width="1000"
        height="12"
        fill={`url(#${sandId})`}
        opacity="0.85"
      />

      {/* Cactus silhouettes — saguaro shape rendered on top of all terrain */}
      {cacti.map((c, i) => (
        <path
          key={`cactus-${i}`}
          d={buildCactusPath(c.cx, c.baseY, c.trunkH, c.armHLen, c.armVLen)}
          fill="#1a1612"
          opacity="0.95"
        />
      ))}
    </svg>
  );
}
