'use client';
import { useId, useMemo } from 'react';
import { mulberry32 } from '@/lib/prng';

interface Stroke {
  y: number;
  x1: number;
  x2: number;
  opacity: number;
}

// Density bias toward yMin (the horizon). Math.pow(uniform, 1.4) compresses
// uniform [0,1) samples toward 0, so y values cluster near yMin — the upper
// waterline catches more reflective shimmer than the foreground.
function genWaveStrokes(
  seed: number,
  yMin: number,
  yMax: number,
  count: number,
  opacityMin: number,
  opacityMax: number,
): Stroke[] {
  const rng = mulberry32(seed);
  const strokes: Stroke[] = [];
  for (let i = 0; i < count; i++) {
    const yBias = Math.pow(rng(), 1.4);
    const y = yMin + yBias * (yMax - yMin);
    const xStart = rng() * 1000;
    const length = 30 + rng() * 120;
    const xEnd = Math.min(1000, xStart + length);
    const opacity = opacityMin + rng() * (opacityMax - opacityMin);
    strokes.push({ y, x1: xStart, x2: xEnd, opacity });
  }
  return strokes;
}

// Foam straddles the water/sand boundary at y=185. Y range 183..187 places
// strokes either side of the seam so the boundary reads as soft surf rather
// than a hard color cut.
function genFoamStrokes(seed: number): Stroke[] {
  const rng = mulberry32(seed);
  const strokes: Stroke[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const y = 183 + rng() * 4;
    const xStart = rng() * 1000;
    const length = 20 + rng() * 40;
    const xEnd = Math.min(1000, xStart + length);
    strokes.push({ y, x1: xStart, x2: xEnd, opacity: 0.35 + rng() * 0.18 });
  }
  return strokes;
}

interface SandDot {
  cx: number;
  cy: number;
  opacity: number;
}

function genSandDots(seed: number): SandDot[] {
  const rng = mulberry32(seed);
  const dots: SandDot[] = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const cx = rng() * 1000;
    // Sand spans y=185..200; offset by 1 unit at top to avoid touching the
    // foam seam, and 0.5 unit at bottom for breathing room.
    const cy = 186 + rng() * 13;
    const opacity = 0.3 + rng() * 0.2;
    dots.push({ cx, cy, opacity });
  }
  return dots;
}

// Build a smooth rolling landmass silhouette spanning the full strip width.
// Peaks vary y=140..158, so portions above the water surface (y=148) read as
// distant land/islands while the rest is occluded — the variation suggests a
// natural shoreline rather than a uniform ridge.
function genLandmassPath(seed: number): string {
  const rng = mulberry32(seed);
  const segments = 18;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * 1000;
    const y = 140 + rng() * 18;
    points.push([x, y]);
  }
  const midX = (a: number, b: number) => (points[a][0] + points[b][0]) / 2;
  const midY = (a: number, b: number) => (points[a][1] + points[b][1]) / 2;
  let d = `M 0 200 L 0 ${points[0][1].toFixed(2)}`;
  d += ` L ${midX(0, 1).toFixed(2)} ${midY(0, 1).toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i++) {
    d +=
      ` Q ${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)},` +
      ` ${midX(i, i + 1).toFixed(2)} ${midY(i, i + 1).toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0].toFixed(2)} ${last[1].toFixed(2)} L 1000 200 Z`;
  return d;
}

interface Boat {
  hullX: number;
  hullY: number;
  hullWidth: number;
  mastTopY: number;
  centerX: number;
}

// Probability check uses the 2nd roll so the same seed feeding position rolls
// is decoupled from the on/off decision — see prior iteration notes.
function genBoat(seed: number, threshold: number): Boat | null {
  const rng = mulberry32(seed);
  const offsetRoll = rng();
  const presenceRoll = rng();
  if (presenceRoll < threshold) return null;
  const widthRoll = rng();
  const yRoll = rng();
  const mastRoll = rng();
  const centerX = 200 + offsetRoll * 600;
  const hullWidth = 8 + widthRoll * 4;
  // Boat sits in water (y=148..185); hullY range 158..164 keeps the hull and
  // 1.5-unit body well above the foam seam at y=183.
  const hullY = 158 + yRoll * 6;
  const mastHeight = 5 + mastRoll * 2;
  return {
    hullX: centerX - hullWidth / 2,
    hullY,
    hullWidth,
    mastTopY: hullY - mastHeight,
    centerX,
  };
}

// Stylized palm-frond cluster paths for the strip's top corners.
// Each cluster is 4 lens-shaped fronds fanning from near the corner. All
// vertices stay inside the viewBox (the SVG clips overflow), so paths
// originate at x=0 (left) / x=1000 (right) rather than slipping off-canvas.
const PALM_LEFT_PATH =
  // Frond 1 — flat right
  'M 0 9 Q 44.8 6.5 95 4 Q 45.2 0.5 0 5 Z' +
  // Frond 2 — diagonal right-down (mid angle)
  ' M 0 10 Q 37.06 18.45 78 28 Q 37.94 14.55 0 6 Z' +
  // Frond 3 — steeper diagonal
  ' M 0 8 Q 28.8 29.1 62 56 Q 31.2 25.9 0 4 Z' +
  // Frond 4 — drooping vertical
  ' M 8 0 Q 15.06 30.41 28 68 Q 17.94 29.59 4 0 Z';

const PALM_RIGHT_PATH =
  'M 1000 9 Q 955.2 6.5 905 4 Q 954.8 0.5 1000 5 Z' +
  ' M 1000 10 Q 962.94 18.45 922 28 Q 962.06 14.55 1000 6 Z' +
  ' M 1000 8 Q 971.2 29.1 938 56 Q 968.8 25.9 1000 4 Z' +
  ' M 992 0 Q 984.94 30.41 972 68 Q 982.06 29.59 996 0 Z';

export default function OceanScene() {
  const uid = useId().replace(/:/g, '');
  const landId = `ocean-land-${uid}`;
  const waterId = `ocean-continuous-${uid}`;
  const sandId = `ocean-sand-${uid}`;
  const hazeId = `ocean-haze-${uid}`;

  const waveStrokes = useMemo(
    () => genWaveStrokes(32, 152, 183, 14, 0.35, 0.6),
    [],
  );
  const foamStrokes = useMemo(() => genFoamStrokes(37), []);
  const sandDots = useMemo(() => genSandDots(38), []);
  const landmassPath = useMemo(() => genLandmassPath(36), []);
  const boat = useMemo(() => genBoat(35, 0.4), []);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        // Sit below the celestial overlay (zIndex: 1) so sun, arc, stars,
        // and clouds always render on top of the water.
        zIndex: 0,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={landId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a6080" />
          <stop offset="100%" stopColor="#3a4060" />
        </linearGradient>
        <linearGradient id={waterId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#404560" />
          <stop offset="35%" stopColor="#2a2e48" />
          <stop offset="70%" stopColor="#1f2238" />
          <stop offset="100%" stopColor="#14162a" />
        </linearGradient>
        <linearGradient id={sandId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3540" />
          <stop offset="100%" stopColor="#2a2530" />
        </linearGradient>
        <filter id={hazeId} x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Distant landmass — sits behind water; only peaks above y=148 show */}
      <path
        d={landmassPath}
        fill={`url(#${landId})`}
        opacity="0.55"
        filter={`url(#${hazeId})`}
      />

      {/* Water plane — single gradient, shortened to leave room for sand */}
      <rect
        x="0"
        y="148"
        width="1000"
        height="37"
        fill={`url(#${waterId})`}
        opacity="0.78"
      />

      {/* Wave hint strokes — broken horizontal lines across the water plane */}
      {waveStrokes.map((s, i) => (
        <line
          key={`w-${i}`}
          x1={s.x1.toFixed(2)}
          y1={s.y.toFixed(2)}
          x2={s.x2.toFixed(2)}
          y2={s.y.toFixed(2)}
          stroke="#5a6080"
          strokeWidth="0.5"
          opacity={s.opacity.toFixed(2)}
        />
      ))}

      {/* Optional distant boat silhouette */}
      {boat && (
        <g opacity="0.78">
          <rect
            x={boat.hullX.toFixed(2)}
            y={boat.hullY.toFixed(2)}
            width={boat.hullWidth.toFixed(2)}
            height="1.5"
            fill="#1a1c30"
          />
          <line
            x1={boat.centerX.toFixed(2)}
            y1={boat.mastTopY.toFixed(2)}
            x2={boat.centerX.toFixed(2)}
            y2={boat.hullY.toFixed(2)}
            stroke="#1a1c30"
            strokeWidth="0.5"
          />
        </g>
      )}

      {/* Sand strip — muted warm-gray foreground at the very bottom */}
      <rect
        x="0"
        y="185"
        width="1000"
        height="15"
        fill={`url(#${sandId})`}
        opacity="0.85"
      />

      {/* Sand grain texture — barely-visible scattered dots */}
      {sandDots.map((d, i) => (
        <circle
          key={`sd-${i}`}
          cx={d.cx.toFixed(2)}
          cy={d.cy.toFixed(2)}
          r="0.3"
          fill="#5a5560"
          opacity={d.opacity.toFixed(2)}
        />
      ))}

      {/* Foam line at the water/sand boundary */}
      {foamStrokes.map((s, i) => (
        <line
          key={`f-${i}`}
          x1={s.x1.toFixed(2)}
          y1={s.y.toFixed(2)}
          x2={s.x2.toFixed(2)}
          y2={s.y.toFixed(2)}
          stroke="rgb(220, 228, 240)"
          strokeWidth="0.4"
          opacity={s.opacity.toFixed(2)}
        />
      ))}

      {/* Palm frond silhouettes framing the top corners */}
      <path d={PALM_LEFT_PATH} fill="rgba(20, 22, 38, 0.85)" opacity="0.78" />
      <path d={PALM_RIGHT_PATH} fill="rgba(20, 22, 38, 0.85)" opacity="0.78" />
    </svg>
  );
}
