'use client';
import { useMemo, useId } from 'react';
import { type WeatherSegment, type SeasonalPalette } from '../types';

interface WeatherLayersProps {
  segments: WeatherSegment[];
  // Reserved for prompt 2c (golden-hour tinting / cloud-through-sun attenuation).
  // Currently unused; cloud rgba values are hardcoded below.
  palette: SeasonalPalette;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 200;

// Storm / heavy-rain WMO codes — render with darker gray-blue cast
const STORM_CODES = new Set<number>([63, 65, 82, 95, 96, 99]);

// Mulberry32 PRNG — deterministic; mirrors Stars.tsx pattern
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function findSegmentAt(segments: WeatherSegment[], h: number): WeatherSegment | undefined {
  if (segments.length === 0) return undefined;
  for (const seg of segments) {
    if (h >= seg.startHour && h < seg.endHour) return seg;
  }
  // h === 24 boundary: only honor the last segment if it actually reaches 24.
  // If segments leave a gap (malformed data), treat that hour as clear sky
  // rather than silently extending the last segment's cloud cover.
  if (h >= 24) {
    const last = segments[segments.length - 1];
    if (last.endHour >= 24) return last;
  }
  return undefined;
}

interface GradientStop {
  offset: string;
  color: string;
}

interface CloudPuff {
  cx: number;
  cy: number;
  r: number;
  rotation: number;
  ellipses: { cx: number; cy: number; rx: number; ry: number }[];
}

function buildGradientStops(segments: WeatherSegment[]): GradientStop[] {
  const stops: GradientStop[] = [];
  for (let h = 0; h <= 24; h++) {
    const seg = findSegmentAt(segments, h);
    const cloudCover = seg?.cloudCover ?? 0;
    const wmo = seg?.wmoCode ?? 0;

    // Non-linear opacity ramp: 0-30% reads almost clear, 70%+ reads dense
    const alpha = Math.pow(Math.max(0, Math.min(100, cloudCover)) / 100, 1.4) * 0.6;

    const color = STORM_CODES.has(wmo)
      ? `rgba(60, 70, 90, ${alpha.toFixed(3)})`
      : `rgba(190, 200, 215, ${alpha.toFixed(3)})`;

    stops.push({
      offset: `${((h / 24) * 100).toFixed(3)}%`,
      color,
    });
  }
  return stops;
}

function buildCloudPuffs(segments: WeatherSegment[]): CloudPuff[] {
  const puffs: CloudPuff[] = [];

  for (const seg of segments) {
    // Cumulus puffs only on partly-cloudy hours (WMO 2)
    if (seg.wmoCode !== 2) continue;

    const xStart = (seg.startHour / 24) * VIEWBOX_WIDTH;
    const xEnd = (seg.endHour / 24) * VIEWBOX_WIDTH;
    const segWidth = xEnd - xStart;
    if (segWidth < 16) continue;

    // Deterministic per-segment RNG: same startHour ⇒ same puff layout across renders
    const seed = Math.floor(seg.startHour * 1000) + 1;
    const rand = mulberry32(seed);

    // 2-4 puffs per partly-cloudy segment
    const count = 2 + Math.floor(rand() * 3);

    for (let i = 0; i < count; i++) {
      // Even spacing with light jitter so they don't line up perfectly
      const t = (i + 0.5) / count + (rand() - 0.5) * (0.5 / count);
      const tClamped = Math.max(0.06, Math.min(0.94, t));
      const cx = xStart + tClamped * segWidth;
      const cy = 25 + rand() * 70;
      const r = 8 + rand() * 6;
      const rotation = -5 + rand() * 10;

      // 4 overlapping ellipses → puffy cumulus silhouette
      // Coordinates are local; the wrapping <g> translates and rotates.
      const ellipses = [
        // Wide flat base
        { cx: 0, cy: r * 0.18, rx: r * 1.05, ry: r * 0.5 },
        // Left shoulder
        { cx: -r * 0.5, cy: -r * 0.04, rx: r * 0.6, ry: r * 0.5 },
        // Right shoulder
        { cx: r * 0.46, cy: -r * 0.1, rx: r * 0.65, ry: r * 0.55 },
        // Top peak
        { cx: -r * 0.05, cy: -r * 0.28, rx: r * 0.55, ry: r * 0.42 },
      ];

      puffs.push({ cx, cy, r, rotation, ellipses });
    }
  }

  return puffs;
}

export default function WeatherLayers({ segments }: WeatherLayersProps) {
  const uid = useId().replace(/:/g, '-');
  const gradientId = `cloud-gradient-${uid}`;
  const blurId = `cloud-blur-${uid}`;

  const gradientStops = useMemo(() => buildGradientStops(segments), [segments]);
  const puffs = useMemo(() => buildCloudPuffs(segments), [segments]);

  if (segments.length === 0) return null;

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          {gradientStops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <filter id={blurId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>

      {/* Layer A — continuous cloud wash spanning the full sky strip */}
      <rect
        x="0"
        y="0"
        width={VIEWBOX_WIDTH}
        height={VIEWBOX_HEIGHT}
        fill={`url(#${gradientId})`}
      />

      {/* Layer B — cumulus puffs over partly-cloudy segments */}
      <g filter={`url(#${blurId})`}>
        {puffs.map((p, i) => (
          <g
            key={i}
            transform={`translate(${p.cx.toFixed(2)},${p.cy.toFixed(2)}) rotate(${p.rotation.toFixed(2)})`}
          >
            {p.ellipses.map((e, j) => (
              <ellipse
                key={j}
                cx={e.cx.toFixed(2)}
                cy={e.cy.toFixed(2)}
                rx={e.rx.toFixed(2)}
                ry={e.ry.toFixed(2)}
                fill="rgba(245, 250, 255, 0.42)"
              />
            ))}
          </g>
        ))}
      </g>
    </g>
  );
}
