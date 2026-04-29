'use client';
import { useId, useMemo } from 'react';
import { mulberry32 } from '@/lib/prng';

type Coord = { x: number; y: number };

function genPeakCoords(
  seed: number,
  minPeakY: number,
  maxPeakY: number,
  points: number,
): Coord[] {
  const rng = mulberry32(seed);
  const stepX = 1000 / (points - 1);
  const coords: Coord[] = [];
  for (let i = 0; i < points; i++) {
    coords.push({
      x: i * stepX,
      y: minPeakY + rng() * (maxPeakY - minPeakY),
    });
  }
  return coords;
}

function coordsToSilhouettePath(coords: Coord[], baselineY: number): string {
  let d = `M 0 ${baselineY}`;
  for (const p of coords) {
    d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  d += ` L 1000 ${baselineY} Z`;
  return d;
}

export default function MountainScene() {
  const uid = useId().replace(/:/g, '');
  const farId = `mtn-bg-far-${uid}`;
  const midId = `mtn-bg-mid-${uid}`;
  const frontId = `mtn-bg-front-${uid}`;
  const hazeId = `mtn-haze-${uid}`;

  const farPath = useMemo(
    () => coordsToSilhouettePath(genPeakCoords(11, 142, 162, 15), 200),
    [],
  );
  const midCoords = useMemo(() => genPeakCoords(12, 128, 148, 18), []);
  const midPath = useMemo(
    () => coordsToSilhouettePath(midCoords, 200),
    [midCoords],
  );
  const frontPath = useMemo(
    () => coordsToSilhouettePath(genPeakCoords(13, 158, 172, 16), 200),
    [],
  );
  const horizonPath = useMemo(
    () => coordsToSilhouettePath(genPeakCoords(14, 194, 198, 125), 200),
    [],
  );

  // Snow hints sit on the four highest mid-layer peaks. Drop the start/end
  // boundary points (x=0 and x=1000) because their hints would clip at the
  // edge and read as artifacts rather than tonal hazing.
  const snowHints = useMemo(() => {
    return midCoords
      .filter((c) => c.x > 30 && c.x < 970)
      .slice()
      .sort((a, b) => a.y - b.y)
      .slice(0, 4);
  }, [midCoords]);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        // Sit below the celestial overlay (zIndex: 1 in SkyStrip) so the sun,
        // arc, stars, and clouds always render on top of the mountains. The
        // ambient mountain layer is background, not foreground.
        zIndex: 0,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={farId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a6080" />
          <stop offset="100%" stopColor="#404560" />
        </linearGradient>
        <linearGradient id={midId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#404560" />
          <stop offset="100%" stopColor="#2a2e48" />
        </linearGradient>
        <linearGradient id={frontId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2e48" />
          <stop offset="100%" stopColor="#1a1c30" />
        </linearGradient>
        <filter id={hazeId} x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Layer 1: far hazy peaks */}
      <path
        d={farPath}
        fill={`url(#${farId})`}
        opacity="0.55"
        filter={`url(#${hazeId})`}
      />

      {/* Layer 2: mid distant peaks */}
      <path d={midPath} fill={`url(#${midId})`} opacity="0.65" />

      {/* Subtle snow hints — barely lighter blobs on highest mid peaks */}
      {snowHints.map((p) => (
        <ellipse
          key={`${p.x.toFixed(0)}-${p.y.toFixed(0)}`}
          cx={p.x.toFixed(2)}
          cy={(p.y + 2.5).toFixed(2)}
          rx="11"
          ry="2.5"
          fill="#5a6080"
          opacity="0.75"
        />
      ))}

      {/* Layer 3: front mid peaks */}
      <path d={frontPath} fill={`url(#${frontId})`} opacity="0.78" />

      {/* Layer 4: horizon conifer line */}
      <path d={horizonPath} fill="#1a1c30" opacity="0.85" />
    </svg>
  );
}
