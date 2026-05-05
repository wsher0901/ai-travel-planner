'use client';
import { useId } from 'react';
import type { ReactNode } from 'react';

// Strategy-pattern cloud renderer. The `cloudSet` prop selects which family
// of cloud shapes to mount; the wrapper applies the predicate-driven CSS
// mask so the chosen set is scoped to the relevant tier x-regions.
//
// `basic` renders 4 cumulus clusters with depth variation (blur + opacity +
// size + y-position). `detailed` and `wispy` are scaffolded for future passes.

const VIEWBOX_W = 100;
const VIEWBOX_H = 100;

interface CloudShapesProps {
  cloudSet: 'basic' | 'detailed' | 'wispy';
  maskGradient: string;
}

interface DepthCluster {
  cx: number;       // x centre (viewBox 0–100)
  cy: number;       // y centre — lower = closer to viewer
  mainRx: number;   // main-mass horizontal radius
  mainRy: number;   // main-mass vertical radius
  blurSd: number;   // feGaussianBlur stdDeviation (0 = no filter)
  opacity: number;  // group opacity
}

// Back → front paint order; front clusters overlap back clusters when they meet.
const DEPTH_CLUSTERS: ReadonlyArray<DepthCluster> = [
  { cx: 18, cy: 12, mainRx: 5.0, mainRy: 3.3, blurSd: 1.5, opacity: 0.50 },
  { cx: 38, cy: 16, mainRx: 6.5, mainRy: 4.3, blurSd: 0.8, opacity: 0.65 },
  { cx: 60, cy: 18, mainRx: 7.0, mainRy: 4.7, blurSd: 0.4, opacity: 0.72 },
  { cx: 80, cy: 22, mainRx: 8.0, mainRy: 5.3, blurSd: 0,   opacity: 0.78 },
];

const CLUSTER_FILL = 'rgba(255, 255, 255, 0.65)';

function BasicCumulusCluster() {
  const uid = useId().replace(/:/g, '-');
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="none"
    >
      <defs>
        {DEPTH_CLUSTERS.map((c, i) =>
          c.blurSd > 0 ? (
            <filter key={i} id={`cloud-blur-${uid}-${i}`}
              x="-20%" y="-20%" width="140%" height="140%"
            >
              <feGaussianBlur stdDeviation={c.blurSd} />
            </filter>
          ) : null,
        )}
      </defs>
      {DEPTH_CLUSTERS.map(({ cx, cy, mainRx, mainRy, blurSd, opacity }, i) => (
        <g
          key={i}
          opacity={opacity}
          filter={blurSd > 0 ? `url(#cloud-blur-${uid}-${i})` : undefined}
        >
          {/* Main cloud mass */}
          <ellipse cx={cx}             cy={cy}                    rx={mainRx}          ry={mainRy}          fill={CLUSTER_FILL} />
          {/* Top puff */}
          <ellipse cx={cx - 1}         cy={cy - mainRy * 0.9}    rx={mainRx * 0.70}   ry={mainRy * 0.80}   fill={CLUSTER_FILL} />
          {/* Side puff */}
          <ellipse cx={cx + mainRx * 0.5} cy={cy + mainRy * 0.15} rx={mainRx * 0.55} ry={mainRy * 0.65}   fill={CLUSTER_FILL} />
        </g>
      ))}
    </svg>
  );
}

function PlaceholderDetailedClouds(): null { return null; }
function PlaceholderWispyClouds(): null    { return null; }

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
