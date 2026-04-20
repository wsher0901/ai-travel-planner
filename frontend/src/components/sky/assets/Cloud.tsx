'use client';

interface Props {
  leftPercent: number;
  topPx: number;
  width?: number;
  tint?: 'neutral' | 'warm' | 'dusk' | 'dark';
  opacity?: number;
  driftDelay?: number;
}

const TINTS = {
  neutral: { top: '#ffffff', bottom: '#c0d4e4' },
  warm: { top: '#ffd4a0', bottom: '#a84848' },
  dusk: { top: '#b89cc4', bottom: '#2e1838' },
  dark: { top: '#8695a8', bottom: '#3a4656' },
};

export default function Cloud({ leftPercent, topPx, width = 95, tint = 'neutral', opacity = 1, driftDelay = 0 }: Props) {
  const c = TINTS[tint];
  const gid = `sky-cloud-${tint}-${Math.round(leftPercent * 10)}-${topPx}`;
  const h = width * 0.42;
  return (
    <div style={{ position: 'absolute', left: `${leftPercent}%`, top: topPx, zIndex: 5, opacity, pointerEvents: 'none', animation: 'skyDrift 10s ease-in-out infinite', animationDelay: `${driftDelay}s` }}>
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} style={{ display: 'block', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.15))' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.top} />
            <stop offset="100%" stopColor={c.bottom} />
          </linearGradient>
        </defs>
        <ellipse cx={width * 0.24} cy={h * 0.6} rx={width * 0.18} ry={h * 0.3} fill={`url(#${gid})`} />
        <ellipse cx={width * 0.5} cy={h * 0.44} rx={width * 0.22} ry={h * 0.36} fill={`url(#${gid})`} />
        <ellipse cx={width * 0.76} cy={h * 0.54} rx={width * 0.2} ry={h * 0.32} fill={`url(#${gid})`} />
        <rect x={width * 0.12} y={h * 0.58} width={width * 0.76} height={h * 0.3} rx={h * 0.15} fill={`url(#${gid})`} />
      </svg>
    </div>
  );
}
