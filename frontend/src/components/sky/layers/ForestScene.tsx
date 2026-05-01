'use client';
import { useId, useMemo } from 'react';
import { mulberry32 } from '@/lib/prng';

interface TreeData {
  x: number;
  height: number;
  width: number;
  isConifer: boolean;
  isHero: boolean;
}

function genTreeLayer(
  seed: number,
  count: number,
  heightMin: number,
  heightMax: number,
  coniferRatio: number,
  heroRatio: number,
): TreeData[] {
  const rng = mulberry32(seed);
  const stepX = 1000 / count;
  const trees: TreeData[] = [];
  for (let i = 0; i < count; i++) {
    const x = i * stepX + (rng() - 0.5) * stepX * 0.6;
    const baseH = heightMin + rng() * (heightMax - heightMin);
    const isHero = rng() < heroRatio;
    const height = isHero ? baseH * 1.4 : baseH;
    const width = height * (0.4 + rng() * 0.3);
    const isConifer = rng() < coniferRatio;
    trees.push({ x, height, width, isConifer, isHero });
  }
  return trees;
}

function coniferPath(x: number, baseY: number, hw: number, h: number): string {
  const f = (n: number) => n.toFixed(1);
  return (
    `M ${f(x - hw)} ${f(baseY)}` +
    ` L ${f(x - hw * 0.4)} ${f(baseY - h * 0.3)}` +
    ` L ${f(x - hw * 0.7)} ${f(baseY - h * 0.35)}` +
    ` L ${f(x - hw * 0.3)} ${f(baseY - h * 0.6)}` +
    ` L ${f(x - hw * 0.5)} ${f(baseY - h * 0.65)}` +
    ` L ${f(x - hw * 0.2)} ${f(baseY - h * 0.85)}` +
    ` L ${f(x)} ${f(baseY - h)}` +
    ` L ${f(x + hw * 0.2)} ${f(baseY - h * 0.85)}` +
    ` L ${f(x + hw * 0.5)} ${f(baseY - h * 0.65)}` +
    ` L ${f(x + hw * 0.3)} ${f(baseY - h * 0.6)}` +
    ` L ${f(x + hw * 0.7)} ${f(baseY - h * 0.35)}` +
    ` L ${f(x + hw * 0.4)} ${f(baseY - h * 0.3)}` +
    ` L ${f(x + hw)} ${f(baseY)} Z`
  );
}

interface DeciduousProps {
  t: TreeData;
  baseY: number;
  color: string;
  withBranches?: boolean;
}

function DeciduousTree({ t, baseY, color, withBranches }: DeciduousProps) {
  const hw = t.width / 2;
  const h = t.height;
  const x = t.x;
  const f = (n: number) => n.toFixed(1);
  return (
    <g fill={color}>
      <ellipse cx={f(x)} cy={f(baseY - h * 0.7)} rx={f(hw)} ry={f(h * 0.5)} />
      <ellipse cx={f(x - hw * 0.4)} cy={f(baseY - h * 0.5)} rx={f(hw * 0.6)} ry={f(h * 0.35)} />
      <ellipse cx={f(x + hw * 0.4)} cy={f(baseY - h * 0.5)} rx={f(hw * 0.6)} ry={f(h * 0.35)} />
      <rect x={f(x - 0.5)} y={f(baseY - h * 0.3)} width="1" height={f(h * 0.3)} />
      {withBranches && t.isHero && (
        <>
          <line
            x1={f(x)} y1={f(baseY - h * 0.3)}
            x2={f(x + hw * 0.5)} y2={f(baseY - h * 0.5)}
            stroke={color} strokeWidth="0.3" strokeOpacity="0.7"
          />
          <line
            x1={f(x)} y1={f(baseY - h * 0.4)}
            x2={f(x - hw * 0.5)} y2={f(baseY - h * 0.55)}
            stroke={color} strokeWidth="0.3" strokeOpacity="0.7"
          />
          <line
            x1={f(x - hw * 0.2)} y1={f(baseY - h * 0.2)}
            x2={f(x + hw * 0.6)} y2={f(baseY - h * 0.3)}
            stroke={color} strokeWidth="0.25" strokeOpacity="0.5"
          />
        </>
      )}
    </g>
  );
}

function TreeLayer({
  trees, baseY, color, withBranches = false,
}: {
  trees: TreeData[];
  baseY: number;
  color: string;
  withBranches?: boolean;
}) {
  return (
    <>
      {trees.map((t, i) =>
        t.isConifer ? (
          <path key={i} d={coniferPath(t.x, baseY, t.width / 2, t.height)} fill={color} />
        ) : (
          <DeciduousTree key={i} t={t} baseY={baseY} color={color} withBranches={withBranches} />
        ),
      )}
    </>
  );
}

export default function ForestScene() {
  const uid = useId().replace(/:/g, '');
  const farGradId   = `forest-far-${uid}`;
  const midGradId   = `forest-mid-${uid}`;
  const frontGradId = `forest-front-${uid}`;
  const hazeId      = `forest-haze-${uid}`;

  const farTrees   = useMemo(() => genTreeLayer(61, 150, 4,  8,  0.95, 0),    []);
  const midTrees   = useMemo(() => genTreeLayer(62, 120, 8,  14, 0.80, 0),    []);
  const frontTrees = useMemo(() => genTreeLayer(63, 90,  12, 20, 0.70, 0.05), []);
  const fgTrees    = useMemo(() => genTreeLayer(64, 70,  14, 24, 0.60, 0.06), []);

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
        <linearGradient id={farGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a6855" />
          <stop offset="100%" stopColor="#3a5042" />
        </linearGradient>
        <linearGradient id={midGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a5042" />
          <stop offset="100%" stopColor="#2a3830" />
        </linearGradient>
        <linearGradient id={frontGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a3830" />
          <stop offset="100%" stopColor="#1a2420" />
        </linearGradient>
        <filter id={hazeId} x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>

      {/* Layer 1: far atmospheric tree line — blurred, lightest */}
      <g opacity="0.55" filter={`url(#${hazeId})`}>
        <rect x="0" y="140" width="1000" height="60" fill={`url(#${farGradId})`} />
        <TreeLayer trees={farTrees} baseY={140} color="#3a5042" />
      </g>

      {/* Layer 2: mid-distant tree line */}
      <g opacity="0.7">
        <rect x="0" y="152" width="1000" height="48" fill={`url(#${midGradId})`} />
        <TreeLayer trees={midTrees} baseY={152} color="#2a3830" />
      </g>

      {/* Atmospheric mist drifting between mid and front layers */}
      <rect x="0" y="170" width="1000" height="10" fill="rgba(160,180,170,0.08)" />

      {/* Layer 3: front tree line — more detail, occasional hero trees */}
      <g opacity="0.82">
        <rect x="0" y="168" width="1000" height="32" fill={`url(#${frontGradId})`} />
        <TreeLayer trees={frontTrees} baseY={168} color="#1a2420" />
      </g>

      {/* Layer 4: foreground — densest, hero trees with branch strokes */}
      <g opacity="0.92">
        <rect x="0" y="185" width="1000" height="15" fill="#0e1814" />
        <TreeLayer trees={fgTrees} baseY={185} color="#0e1814" withBranches />
      </g>
    </svg>
  );
}
