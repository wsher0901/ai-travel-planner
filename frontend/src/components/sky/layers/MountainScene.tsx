'use client';
import { Fragment, useId, useMemo } from 'react';
import { mulberry32 } from '@/lib/prng';

const BASELINE_Y = 200;

function ptsToSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return ` L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = ` L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const m0x = ((pts[0].x + pts[1].x) / 2).toFixed(1);
  const m0y = ((pts[0].y + pts[1].y) / 2).toFixed(1);
  d += ` L ${m0x} ${m0y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2).toFixed(1);
    const my = ((pts[i].y + pts[i + 1].y) / 2).toFixed(1);
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx} ${my}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${pts[pts.length - 1].y.toFixed(1)}`;
  return d;
}

// Peak-aware path builder: peak vertices (local Y-minima) stay sharp via L
// commands; valley vertices use Q midpoint-bezier smoothing.
function ptsToSharpPeakPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return ` L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  const fmt = (v: number) => v.toFixed(1);
  const isPk = (i: number) =>
    i > 0 && i < pts.length - 1 && pts[i].y < pts[i - 1].y && pts[i].y < pts[i + 1].y;

  let d = ` L ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  // Initial midpoint entry — skip if pts[1] is itself a peak
  if (!isPk(1)) {
    d += ` L ${fmt((pts[0].x + pts[1].x) / 2)} ${fmt((pts[0].y + pts[1].y) / 2)}`;
  }

  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    if (isPk(i)) {
      // Exact apex via L in; L to next midpoint re-enters Q smooth mode
      d += ` L ${fmt(pts[i].x)} ${fmt(pts[i].y)} L ${fmt(mx)} ${fmt(my)}`;
    } else {
      d += ` Q ${fmt(pts[i].x)} ${fmt(pts[i].y)} ${fmt(mx)} ${fmt(my)}`;
    }
  }

  d += ` L ${fmt(pts[pts.length - 1].x)} ${fmt(pts[pts.length - 1].y)}`;
  return d;
}

function genOrganicRidge(
  seed: number,
  pointCount: number,
  peakYMin: number,
  peakYMax: number,
  jitterX = 5,
): string {
  const rng = mulberry32(seed);
  const stepX = 1000 / (pointCount - 1);
  const ridgePts: { x: number; y: number }[] = [];
  for (let i = 0; i < pointCount; i++) {
    const baseX = i * stepX;
    const x =
      i === 0 || i === pointCount - 1
        ? baseX
        : baseX + (rng() * 2 - 1) * jitterX;
    const y = peakYMin + rng() * (peakYMax - peakYMin);
    ridgePts.push({ x, y });
  }
  return `M 0 ${BASELINE_Y}` + ptsToSmoothPath(ridgePts) + ` L 1000 ${BASELINE_Y} Z`;
}

interface AsymRidgeConfig {
  peakCount: number;
  peakYMin: number;
  peakYMax: number;
  valleyYMin: number;
  valleyYMax: number;
  bumps: boolean;
  plateaus: boolean;
  forceSignaturePeaks?: number;
}

function genAsymmetricRidge(seed: number, cfg: AsymRidgeConfig): string {
  const rng = mulberry32(seed);
  const {
    peakCount,
    peakYMin,
    peakYMax,
    valleyYMin,
    valleyYMax,
    bumps,
    plateaus,
    forceSignaturePeaks = 0,
  } = cfg;

  const peakXs: number[] = [];
  for (let i = 0; i < peakCount; i++) {
    const slotMin = (i / peakCount) * 1000 + 30;
    const slotMax = ((i + 1) / peakCount) * 1000 - 30;
    peakXs.push(slotMin + rng() * (slotMax - slotMin));
  }
  const peakYs = peakXs.map(() => peakYMin + rng() * (peakYMax - peakYMin));

  if (forceSignaturePeaks >= 1) {
    const leftThirdEnd = Math.floor(peakCount / 3);
    const leftIdx = Math.floor(rng() * Math.max(1, leftThirdEnd));
    peakYs[leftIdx] = peakYMin;
  }
  if (forceSignaturePeaks >= 2) {
    const rightStart = Math.ceil(peakCount / 3) + 1;
    const rightRange = peakCount - rightStart;
    const rightIdx = rightStart + Math.floor(rng() * Math.max(1, rightRange));
    peakYs[Math.min(rightIdx, peakCount - 1)] = peakYMin;
  }

  const valleyXs: number[] = [0];
  const valleyYs: number[] = [valleyYMin + rng() * (valleyYMax - valleyYMin)];
  for (let i = 0; i < peakCount - 1; i++) {
    const bias = 0.38 + rng() * 0.24;
    valleyXs.push(peakXs[i] + (peakXs[i + 1] - peakXs[i]) * bias);
    valleyYs.push(valleyYMin + rng() * (valleyYMax - valleyYMin));
  }
  valleyXs.push(1000);
  valleyYs.push(valleyYMin + rng() * (valleyYMax - valleyYMin));

  const pts: { x: number; y: number }[] = [{ x: 0, y: valleyYs[0] }];

  for (let i = 0; i < peakCount; i++) {
    const px = peakXs[i];
    const py = peakYs[i];
    const rightValX = valleyXs[i + 1];
    const rightValY = valleyYs[i + 1];

    if (plateaus && i > 0 && rng() < 0.22) {
      const leftValX = valleyXs[i];
      const t1 = 0.44 + rng() * 0.22;
      const plateauX1 = leftValX + (px - leftValX) * t1;
      const plateauX2 = plateauX1 + 12 + rng() * 28;
      const plateauY = py + 6 + rng() * 14;
      if (plateauX2 < px - 8) {
        pts.push({ x: plateauX1, y: plateauY });
        pts.push({ x: plateauX2, y: plateauY + rng() * 3 });
      }
    }

    pts.push({ x: px, y: py });

    if (bumps && rng() < 0.38) {
      const bumpT = 0.15 + rng() * 0.28;
      const bumpX = px + (rightValX - px) * bumpT;
      const bumpY = py + (rightValY - py) * (0.12 + rng() * 0.28);
      pts.push({ x: bumpX, y: bumpY });
    }

    if (i < peakCount - 1) {
      pts.push({ x: rightValX, y: rightValY });
    }
  }

  pts.push({ x: 1000, y: valleyYs[valleyYs.length - 1] });
  pts.sort((a, b) => a.x - b.x);

  return `M 0 ${BASELINE_Y}` + ptsToSharpPeakPath(pts) + ` L 1000 ${BASELINE_Y} Z`;
}

interface FacetedRidgeConfig {
  peakCount: number;
  peakYMin: number;
  peakYMax: number;
  valleyYMin: number;
  valleyYMax: number;
  signaturePeakIndex: number;
  signaturePeakYMin: number;
  secondPeakIndex?: number;
  secondPeakYMin?: number;
}

interface PeakFacet {
  litPoints: string;
  shadowPoints: string;
}

// Each peak rendered as two triangular facets sharing the exact apex vertex.
// LIT face (left slope) = warm #a07868; SHADOW face (right slope) = cool #2e3140.
// Slopes are asymmetric per peak via seeded litFraction [0.35, 0.65].
// A continuous basePath silhouette renders beneath all facets to prevent sky bleed.
function genFacetedRidge(
  seed: number,
  config: FacetedRidgeConfig,
): { basePath: string; facets: PeakFacet[] } {
  const rng = mulberry32(seed);
  const {
    peakCount,
    peakYMin,
    peakYMax,
    valleyYMin,
    valleyYMax,
    signaturePeakIndex,
    signaturePeakYMin,
    secondPeakIndex,
    secondPeakYMin,
  } = config;
  const fmt = (v: number) => v.toFixed(1);

  // Peak X: evenly spaced centres with ±40 jitter
  const peakXs: number[] = [];
  for (let i = 0; i < peakCount; i++) {
    const baseX = ((i + 0.5) / peakCount) * 1000;
    const jitter = (rng() * 2 - 1) * 40;
    peakXs.push(Math.max(30, Math.min(970, baseX + jitter)));
  }
  peakXs.sort((a, b) => a - b);

  // Valley X midpoints used for the continuous basePath silhouette
  const valleyXs: number[] = [0];
  for (let i = 0; i < peakCount - 1; i++) {
    valleyXs.push((peakXs[i] + peakXs[i + 1]) / 2);
  }
  valleyXs.push(1000);

  // Peak Y (smaller = higher on screen)
  const peakYs: number[] = peakXs.map(() => peakYMin + rng() * (peakYMax - peakYMin));
  peakYs[signaturePeakIndex] = signaturePeakYMin;
  if (secondPeakIndex !== undefined && secondPeakYMin !== undefined && secondPeakIndex < peakCount) {
    peakYs[secondPeakIndex] = secondPeakYMin;
  }

  // Valley Y
  const valleyYs: number[] = valleyXs.map(() => valleyYMin + rng() * (valleyYMax - valleyYMin));

  const toStr = (p: { x: number; y: number }[]) =>
    p.map(v => `${fmt(v.x)},${fmt(v.y)}`).join(' ');

  // Per-peak asymmetric facets via seeded RNG — reproducible across re-renders
  const facets: PeakFacet[] = [];
  for (let i = 0; i < peakCount; i++) {
    const ap = { x: peakXs[i], y: peakYs[i] };

    // Average distance to adjacent peaks × 0.9 for base width
    const leftDist = i > 0
      ? peakXs[i] - peakXs[i - 1]
      : (i + 1 < peakCount ? peakXs[i + 1] - peakXs[i] : 200);
    const rightDist = i + 1 < peakCount
      ? peakXs[i + 1] - peakXs[i]
      : leftDist;
    const distAvg = (leftDist + rightDist) / 2;
    const widthVariance = (rng() * 2 - 1) * 0.15; // ±15% per peak
    let peakBaseWidth = distAvg * 0.9 * (1 + widthVariance);

    // Signature peak gets a 1.4× wider base for dominant silhouette
    if (i === signaturePeakIndex) peakBaseWidth *= 1.4;

    // Asymmetric lit/shadow split — long lit + short shadow or reversed
    const litFraction = 0.35 + rng() * 0.30; // [0.35, 0.65]

    const lv = { x: Math.max(0, ap.x - peakBaseWidth * litFraction), y: valleyYs[i] };
    const rv = { x: Math.min(1000, ap.x + peakBaseWidth * (1 - litFraction)), y: valleyYs[i + 1] };
    // Vertical drop from apex aligns with the deeper adjacent valley
    const vb = { x: ap.x, y: Math.max(lv.y, rv.y) };

    facets.push({
      litPoints:    toStr([lv, ap, vb]),
      shadowPoints: toStr([vb, ap, rv]),
    });
  }

  // Continuous basePath — sharp peaks match facet apexes exactly (no gap at tips)
  const allPts: { x: number; y: number }[] = [{ x: 0, y: valleyYs[0] }];
  for (let i = 0; i < peakCount; i++) {
    allPts.push({ x: peakXs[i], y: peakYs[i] });
    if (i < peakCount - 1) allPts.push({ x: valleyXs[i + 1], y: valleyYs[i + 1] });
  }
  allPts.push({ x: 1000, y: valleyYs[valleyYs.length - 1] });

  // Sharp peaks on body fill matches Layer 3 logic; prevents sky bleed through valleys
  const basePath = `M 0 ${BASELINE_Y}` + ptsToSharpPeakPath(allPts) + ` L 1000 ${BASELINE_Y} Z`;

  return { basePath, facets };
}

export default function MountainScene() {
  const uid = useId().replace(/:/g, '');
  const midFarId = `mtn-midfar-${uid}`;
  const midId    = `mtn-mid-${uid}`;
  const hazeId   = `mtn-haze-${uid}`;

  const farPath    = useMemo(() => genOrganicRidge(21, 12, 152, 168, 10), []);
  const midFarPath = useMemo(
    () =>
      genAsymmetricRidge(22, {
        peakCount:  4,
        peakYMin:   138,
        peakYMax:   150,
        valleyYMin: 165,
        valleyYMax: 180,
        bumps:      false,
        plateaus:   false,
      }),
    [],
  );
  const midPath = useMemo(
    () =>
      genAsymmetricRidge(23, {
        peakCount:  7,
        peakYMin:   103,
        peakYMax:   118,
        valleyYMin: 168,
        valleyYMax: 184,
        bumps:      false,
        plateaus:   true,
      }),
    [],
  );
  const anchorPath  = useMemo(() => genOrganicRidge(25, 10, 178, 188, 8), []);
  const frontFacets = useMemo(
    () =>
      genFacetedRidge(24, {
        peakCount:          7,
        peakYMin:           95,
        peakYMax:           115,
        valleyYMin:         175,
        valleyYMax:         188,
        signaturePeakIndex: 3,
        signaturePeakYMin:  55,
        secondPeakIndex:    5,
        secondPeakYMin:     78,
      }),
    [],
  );

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
        <linearGradient
          id={midFarId}
          x1="0" y1="138"
          x2="0" y2="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#7888a8" />
          <stop offset="100%" stopColor="#3a4560" />
        </linearGradient>

        <linearGradient
          id={midId}
          x1="0" y1="103"
          x2="0" y2="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#687080" />
          <stop offset="50%"  stopColor="#4a4f60" />
          <stop offset="100%" stopColor="#232838" />
        </linearGradient>

        <filter id={hazeId} x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>

      {/* Layer 1 — far haze, seed 21 */}
      <path
        d={farPath}
        fill="#8898b8"
        opacity="0.35"
        filter={`url(#${hazeId})`}
      />

      {/* Layer 2 — mid-far: 4 explicit peaks, lighter value for recession, seed 22 */}
      <path d={midFarPath} fill={`url(#${midFarId})`} opacity="0.68" />

      {/* Layer 3 — mid: cool slate rim, sharp peak tips via ptsToSharpPeakPath, seed 23 */}
      <path d={midPath} fill={`url(#${midId})`} opacity="0.80" />

      {/* Layer 4 — front: continuous body fill behind facets prevents sky bleed, seed 24 */}
      <path d={frontFacets.basePath} fill="#2a2d3a" opacity="1" />
      {frontFacets.facets.map((facet, i) => (
        <Fragment key={i}>
          <polygon points={facet.litPoints}    fill="#a07868" />
          <polygon points={facet.shadowPoints} fill="#2e3140" />
        </Fragment>
      ))}

      {/* Layer 5 — near-black anchor that grounds the strip, seed 25 */}
      <path d={anchorPath} fill="#0e1018" opacity="1" />
    </svg>
  );
}
