'use client';
import { useId, useMemo } from 'react';
import { mulberry32 } from '@/lib/prng';

type Roof = 'flat' | 'stepped' | 'peaked' | 'dome' | 'antenna' | 'tiered';

interface Building {
  x: number;
  width: number;
  peakY: number;
  roof: Roof;
  centerFactor: number;
}

interface Windowed {
  x: number;
  y: number;
  color: string;
  opacity: number;
  size: number; // 0=small (mid), 1=full (front)
}

const BASELINE_Y = 200;

function pickRoofType(rng: () => number, centerFactor: number): Roof {
  const r = rng();
  // Center buildings (the focal cluster) bias toward characterful tops.
  if (centerFactor > 0.7) {
    if (r < 0.12) return 'antenna';
    if (r < 0.22) return 'dome';
    if (r < 0.32) return 'peaked';
    if (r < 0.5) return 'tiered';
    if (r < 0.65) return 'stepped';
    return 'flat';
  }
  if (centerFactor > 0.45) {
    if (r < 0.45) return 'flat';
    if (r < 0.62) return 'stepped';
    if (r < 0.72) return 'tiered';
    if (r < 0.82) return 'peaked';
    if (r < 0.92) return 'antenna';
    return 'dome';
  }
  // Edges read as lower-density urban fringe — mostly flat, occasional stepped.
  if (r < 0.78) return 'flat';
  if (r < 0.94) return 'stepped';
  return 'peaked';
}

function generateLayer(
  seed: number,
  peakRange: [number, number],
  widthRange: [number, number],
): Building[] {
  const rng = mulberry32(seed);
  const buildings: Building[] = [];
  let x = 0;
  while (x < 1000) {
    const w = widthRange[0] + rng() * (widthRange[1] - widthRange[0]);
    const cx = x + w / 2;
    const distFromCenter = Math.abs(cx - 500) / 500; // 0 at center, 1 at edges
    const centerFactor = Math.max(0.3, 1 - distFromCenter);
    const heightRand = peakRange[0] + rng() * (peakRange[1] - peakRange[0]);
    const peakY = BASELINE_Y - (BASELINE_Y - heightRand) * centerFactor;
    const roof = pickRoofType(rng, centerFactor);
    buildings.push({ x, width: w, peakY, roof, centerFactor });
    x += w;
  }
  return buildings;
}

// Hard floor for any rendered building element. Sun sits at ~y=60 and the spec
// requires every building element to remain at or below y=95 so the sun and
// arc are never occluded. Clamp here rather than at the call sites.
const SKY_FLOOR = 95;

function buildBodyPath(b: Building): string {
  const { x, width: w, peakY, roof } = b;
  const x2 = x + w;
  switch (roof) {
    case 'flat':
    case 'antenna':
      return `M ${x} ${BASELINE_Y} L ${x} ${peakY.toFixed(2)} L ${x2} ${peakY.toFixed(2)} L ${x2} ${BASELINE_Y} Z`;
    case 'stepped': {
      const stepX = (x + w * 0.62).toFixed(2);
      const stepY = (peakY + Math.min(7, (BASELINE_Y - peakY) * 0.18)).toFixed(2);
      return `M ${x} ${BASELINE_Y} L ${x} ${peakY.toFixed(2)} L ${stepX} ${peakY.toFixed(2)} L ${stepX} ${stepY} L ${x2} ${stepY} L ${x2} ${BASELINE_Y} Z`;
    }
    case 'peaked': {
      const apexX = (x + w / 2).toFixed(2);
      const peakHeight = Math.min(w * 0.45, BASELINE_Y - peakY);
      const apexY = Math.max(SKY_FLOOR, peakY - peakHeight).toFixed(2);
      return `M ${x} ${BASELINE_Y} L ${x} ${peakY.toFixed(2)} L ${apexX} ${apexY} L ${x2} ${peakY.toFixed(2)} L ${x2} ${BASELINE_Y} Z`;
    }
    case 'dome': {
      const r = w / 2;
      // sweep-flag 0 makes the arc bow upward (the dome sits above peakY).
      // With sweep-flag 1 the arc would bow downward and create a concave
      // notch in the roofline.
      return `M ${x} ${BASELINE_Y} L ${x} ${peakY.toFixed(2)} A ${r} ${r} 0 0 0 ${x2} ${peakY.toFixed(2)} L ${x2} ${BASELINE_Y} Z`;
    }
    case 'tiered': {
      const inset = w * 0.22;
      const tierY = (peakY + (BASELINE_Y - peakY) * 0.35).toFixed(2);
      const x1a = (x + inset).toFixed(2);
      const x1b = (x2 - inset).toFixed(2);
      return `M ${x} ${BASELINE_Y} L ${x} ${tierY} L ${x1a} ${tierY} L ${x1a} ${peakY.toFixed(2)} L ${x1b} ${peakY.toFixed(2)} L ${x1b} ${tierY} L ${x2} ${tierY} L ${x2} ${BASELINE_Y} Z`;
    }
  }
}

function generateWindowsForBuilding(
  b: Building,
  size: 'mid' | 'front',
): Windowed[] {
  // Salt the per-building seed by layer so two buildings at the same x and
  // size in different layers don't share an identical lit/dark pattern.
  const layerSalt = size === 'front' ? 0xa1f3 : 0x57c2;
  const cellW = size === 'front' ? 1.4 : 1.2;
  const cellH = size === 'front' ? 1.6 : 1.4;
  const colSpacing = size === 'front' ? 4.5 : 4.0;
  const rowSpacing = size === 'front' ? 4.5 : 4.0;
  const maxCols = size === 'front' ? 6 : 4;
  const maxRows = size === 'front' ? 12 : 8;
  const litThreshold = size === 'front' ? 0.28 : 0.42;

  const innerW = b.width - 4; // leave 2 unit margin each side
  const buildingHeight = BASELINE_Y - b.peakY;
  const innerH = Math.max(0, buildingHeight - 5); // top margin for roof
  if (innerW <= colSpacing || innerH <= rowSpacing) return [];

  const cols = Math.min(maxCols, Math.max(2, Math.floor(innerW / colSpacing)));
  const rows = Math.min(maxRows, Math.max(2, Math.floor(innerH / rowSpacing)));

  const colStep = innerW / cols;
  const rowStep = innerH / rows;
  const startX = b.x + 2 + (colStep - cellW) / 2;
  const startY = b.peakY + 4 + (rowStep - cellH) / 2;

  const seed =
    Math.floor(b.x * 31.7) +
    Math.floor(b.peakY * 17.3) +
    Math.floor(b.width) +
    layerSalt;
  const rng = mulberry32(seed);

  const windows: Windowed[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const litRand = rng();
      const colorRand = rng();
      const opacityRand = rng();
      if (litRand < litThreshold) continue;
      const color =
        colorRand < 0.6
          ? '#FFD56B'
          : colorRand < 0.95
            ? '#FFE9A8'
            : '#C8A4F0';
      const opacity = 0.5 + opacityRand * 0.45;
      windows.push({
        x: startX + col * colStep,
        y: startY + row * rowStep,
        color,
        opacity,
        size: size === 'front' ? 1 : 0,
      });
    }
  }
  return windows;
}

interface AntennaLine {
  x: number;
  topY: number;
  bottomY: number;
  hero: boolean;
}

export default function CityScene() {
  const uid = useId().replace(/:/g, '');
  const farId = `bldg-far-${uid}`;
  const midId = `bldg-mid-${uid}`;
  const frontId = `bldg-front-${uid}`;
  const hazeId = `city-haze-${uid}`;

  const farBuildings = useMemo(
    () => generateLayer(21, [145, 165], [10, 24]),
    [],
  );
  const midBuildings = useMemo(
    () => generateLayer(22, [110, 150], [12, 28]),
    [],
  );
  const frontBuildings = useMemo(
    () => generateLayer(23, [95, 145], [14, 32]),
    [],
  );

  const farPath = useMemo(
    () => farBuildings.map(buildBodyPath).join(' '),
    [farBuildings],
  );
  const midPath = useMemo(
    () => midBuildings.map(buildBodyPath).join(' '),
    [midBuildings],
  );
  const frontPath = useMemo(
    () => frontBuildings.map(buildBodyPath).join(' '),
    [frontBuildings],
  );

  const midWindows = useMemo(
    () => midBuildings.flatMap((b) => generateWindowsForBuilding(b, 'mid')),
    [midBuildings],
  );
  const frontWindows = useMemo(
    () => frontBuildings.flatMap((b) => generateWindowsForBuilding(b, 'front')),
    [frontBuildings],
  );

  // Antennas extend above the building's flat top by a small height. Clamp
  // topY at SKY_FLOOR so the line stays at or below y=95 (sun-visibility).
  const antennas = useMemo<AntennaLine[]>(() => {
    const lines: AntennaLine[] = [];
    for (const b of frontBuildings) {
      if (b.roof !== 'antenna') continue;
      const heroEligible =
        b.centerFactor > 0.55 && b.peakY < 115 && b.width > 16;
      const antennaHeight = heroEligible
        ? 12 + b.centerFactor * 6
        : 6 + b.centerFactor * 3;
      const topY = Math.max(SKY_FLOOR, b.peakY - antennaHeight);
      lines.push({
        x: b.x + b.width / 2,
        topY,
        bottomY: b.peakY,
        hero: heroEligible && topY < b.peakY - 4,
      });
    }
    return lines;
  }, [frontBuildings]);

  const beacons = useMemo(() => {
    return antennas
      .filter((a) => a.hero)
      .sort((a, b) => a.topY - b.topY)
      .slice(0, 3);
  }, [antennas]);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        // Sit below the celestial overlay (zIndex: 1) so sun, arc, stars,
        // and clouds always render on top of the skyline.
        zIndex: 0,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={farId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a6080" />
          <stop offset="100%" stopColor="#3a4060" />
        </linearGradient>
        <linearGradient id={midId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a4060" />
          <stop offset="100%" stopColor="#22263c" />
        </linearGradient>
        <linearGradient id={frontId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22263c" />
          <stop offset="100%" stopColor="#0e1020" />
        </linearGradient>
        <filter id={hazeId} x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>

      {/* Layer 1: far hazy skyline */}
      <path
        d={farPath}
        fill={`url(#${farId})`}
        opacity="0.55"
        filter={`url(#${hazeId})`}
      />

      {/* Layer 2: mid-distance skyline */}
      <path d={midPath} fill={`url(#${midId})`} opacity="0.72" />
      {midWindows.map((w, i) => (
        <rect
          key={`mw-${i}`}
          x={w.x.toFixed(2)}
          y={w.y.toFixed(2)}
          width="1.2"
          height="1.4"
          fill={w.color}
          opacity={w.opacity * 0.85}
        />
      ))}

      {/* Layer 3: foreground skyline */}
      <path d={frontPath} fill={`url(#${frontId})`} opacity="0.85" />

      {/* Antennas — vertical hairlines on antenna-roof buildings */}
      {antennas.map((a, i) => (
        <line
          key={`ant-${i}`}
          x1={a.x.toFixed(2)}
          y1={a.bottomY.toFixed(2)}
          x2={a.x.toFixed(2)}
          y2={a.topY.toFixed(2)}
          stroke="#0e1020"
          strokeWidth="0.6"
          opacity="0.95"
        />
      ))}

      {/* Front-layer windows */}
      {frontWindows.map((w, i) => (
        <rect
          key={`fw-${i}`}
          x={w.x.toFixed(2)}
          y={w.y.toFixed(2)}
          width="1.4"
          height="1.6"
          fill={w.color}
          opacity={w.opacity}
        />
      ))}

      {/* Beacons — red dot + halo on hero antenna tops */}
      {beacons.map((b, i) => (
        <g key={`beacon-${i}`}>
          <circle
            cx={b.x.toFixed(2)}
            cy={b.topY.toFixed(2)}
            r="3"
            fill="#DC6E50"
            opacity="0.4"
          />
          <circle
            cx={b.x.toFixed(2)}
            cy={b.topY.toFixed(2)}
            r="1.1"
            fill="#DC6E50"
          />
        </g>
      ))}

      {/* Subtle warm ground glow at base of skyline */}
      <rect
        x="0"
        y="190"
        width="1000"
        height="10"
        fill="rgba(255, 213, 107, 0.06)"
      />
    </svg>
  );
}
