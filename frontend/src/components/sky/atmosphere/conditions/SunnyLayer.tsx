'use client';
import { useMemo, useId } from 'react';
import { useSceneWeather } from '../SceneAtmosphere';
import { buildWhiteMaskGradient } from '../maskUtils';
import { minuteToTimelinePercent } from '@/lib/timelineInset';
import type { SceneAtmosphere } from '@/lib/weather/types';

// Sunny-tier ambient overlay = warm wash + 3 near-vertical trapezoid ray beams
// per sunny segment (back-to-front cluster, slight fan: -5° / 0° / +5°).
// CelestialBodies remains the canonical sun disc.

const VIEWBOX_W = 100;
const VIEWBOX_H = 100;

// Minutes per sample in the 48-stop daily array.
const MIN_PER_SAMPLE = 30;

// Trapezoid geometry constants (viewBox units = % of strip dimension).
const TOP_Y    = 0;    // top edge at viewport top; clipped by parent overflow:hidden
const BOT_Y    = 70;   // bottom edge above mountain silhouettes
const TOP_HALF = 1.5;  // half of 3-unit top width
const BOT_HALF = 3.5;  // half of 7-unit bottom width
const LEAN     = 0.6;  // 7 × tan(5°) ≈ 0.612 units — horizontal shift per leaning ray
const SPACING  = 4.5;  // center-to-center gap between adjacent rays in a cluster

function isSunnyDaylight(atmo: SceneAtmosphere): boolean {
  return atmo.conditionTier === 'sunny' && atmo.sunVisible;
}

// Trapezoid path for one beam.
// cx: x-center; lean: lateral offset applied to both bottom corners.
function rayTrapezoid(
  cx: number,
  lean: number,
): string {
  const f = (n: number) => n.toFixed(2);
  return (
    `M ${f(cx - TOP_HALF)} ${TOP_Y}` +
    ` L ${f(cx + TOP_HALF)} ${TOP_Y}` +
    ` L ${f(cx + BOT_HALF + lean)} ${BOT_Y}` +
    ` L ${f(cx - BOT_HALF + lean)} ${BOT_Y}` +
    ` Z`
  );
}

// Scan samples48 for contiguous sunny-daylight runs; return the midpoint x%
// of each run so we know where to centre a 3-ray cluster.
function findSunnyRunMidpoints(samples: ReadonlyArray<SceneAtmosphere>): number[] {
  const midpoints: number[] = [];
  let runStart = -1;
  for (let i = 0; i <= samples.length; i++) {
    const on = i < samples.length && isSunnyDaylight(samples[i]);
    if (on && runStart === -1) {
      runStart = i;
    } else if (!on && runStart !== -1) {
      const midIdx = (runStart + i - 1) / 2;
      midpoints.push(minuteToTimelinePercent(midIdx * MIN_PER_SAMPLE));
      runStart = -1;
    }
  }
  return midpoints;
}

export default function SunnyLayer() {
  const { samples48 } = useSceneWeather();
  const uid = useId().replace(/:/g, '-');
  const gradId = `sunny-ray-grad-${uid}`;
  const blurId = `sunny-ray-blur-${uid}`;

  const maskImage = useMemo(() => {
    const any = samples48.some(isSunnyDaylight);
    return any ? buildWhiteMaskGradient(samples48, isSunnyDaylight) : null;
  }, [samples48]);

  const runMidpoints = useMemo(
    () => (maskImage ? findSunnyRunMidpoints(samples48) : []),
    [samples48, maskImage],
  );

  if (!maskImage) return null;

  return (
    <>
      {/* (a) Warm wash — full-strip vertical gradient masked to sunny daylight regions */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(255,224,130,0.06) 0%, rgba(255,192,100,0.10) 100%)',
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      />

      {/* (b) Trapezoid ray clusters — one 3-beam fan per sunny segment.
          Outer div carries the daylight mask; inner SVG renders the geometry.
          Blur via feGaussianBlur gives soft volumetric edges. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          maskImage,
          WebkitMaskImage: maskImage,
        }}
      >
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(255,208,96,0.42)" />
              <stop offset="100%" stopColor="rgba(255,208,96,0)" />
            </linearGradient>
            <filter id={blurId} x="-20%" y="-5%" width="140%" height="120%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
          </defs>
          {runMidpoints.map((midX, ri) => (
            <g key={ri} filter={`url(#${blurId})`}>
              {/* Left ray: slants 5° left */}
              <path d={rayTrapezoid(midX - SPACING, -LEAN)} fill={`url(#${gradId})`} />
              {/* Middle ray: vertical */}
              <path d={rayTrapezoid(midX, 0)} fill={`url(#${gradId})`} />
              {/* Right ray: slants 5° right */}
              <path d={rayTrapezoid(midX + SPACING, LEAN)} fill={`url(#${gradId})`} />
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
