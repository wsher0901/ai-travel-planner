'use client';
import type { ReactNode } from 'react';

// Strategy-pattern cloud renderer. The `cloudSet` prop selects which family
// of cloud shapes to mount; the wrapper applies the predicate-driven CSS
// mask so the chosen set is scoped to the relevant tier x-regions.
//
// Today only `basic` is fleshed out (3 cumulus clusters in the upper-third
// of the strip). `detailed` and `wispy` are scaffolded for future passes —
// they return null so the prop is forward-compatible without an API break.

const VIEWBOX_W = 100;
const VIEWBOX_H = 100;

interface CloudShapesProps {
  cloudSet: 'basic' | 'detailed' | 'wispy';
  // CSS mask-image string from buildWhiteMaskGradient. Applied at the
  // wrapper so all cloud strategies inherit the same scoping ramp.
  maskGradient: string;
}

// Each cluster = 3 overlapping ellipses in the upper-third of the strip.
// Positions and sizes are authored in viewBox 0–100 units.
interface ClusterSpec {
  cx: number;
  cy: number;
}

const BASIC_CLUSTERS: ReadonlyArray<ClusterSpec> = [
  { cx: 15, cy: 18 },
  { cx: 45, cy: 22 },
  { cx: 75, cy: 18 },
];

const CLUSTER_FILL = 'rgba(255, 255, 255, 0.65)';

function BasicCumulusCluster() {
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="none"
    >
      {BASIC_CLUSTERS.map(({ cx, cy }, i) => (
        <g key={i}>
          {/* Main mass */}
          <ellipse cx={cx}     cy={cy}     rx={6}   ry={4}   fill={CLUSTER_FILL} />
          {/* Top puff */}
          <ellipse cx={cx - 1} cy={cy - 3} rx={4}   ry={3.2} fill={CLUSTER_FILL} />
          {/* Right puff */}
          <ellipse cx={cx + 3} cy={cy + 0.5} rx={3.5} ry={2.8} fill={CLUSTER_FILL} />
        </g>
      ))}
    </svg>
  );
}

// Placeholders — return null for now. Future passes can replace.
function PlaceholderDetailedClouds() {
  return null;
}

function PlaceholderWispyClouds() {
  return null;
}

const cloudSetRenderers: Record<CloudShapesProps['cloudSet'], () => ReactNode> = {
  basic:    () => <BasicCumulusCluster />,
  detailed: () => <PlaceholderDetailedClouds />,
  wispy:    () => <PlaceholderWispyClouds />,
};

export default function CloudShapes({ cloudSet, maskGradient }: CloudShapesProps) {
  const render = cloudSetRenderers[cloudSet];
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        maskImage: maskGradient,
        WebkitMaskImage: maskGradient,
      }}
    >
      {render()}
    </div>
  );
}
