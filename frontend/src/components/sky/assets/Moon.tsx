'use client';

interface Props {
  leftPercent: number;
  topPx?: number;
  size?: number;
  opacity?: number;
}

export default function Moon({ leftPercent, topPx = 28, size = 38, opacity = 1 }: Props) {
  return (
    <div style={{ position: 'absolute', left: `${leftPercent}%`, top: topPx, transform: 'translateX(-50%)', zIndex: 6, opacity, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: -10, background: 'radial-gradient(circle, rgba(240,235,210,0.35) 0%, transparent 65%)', borderRadius: '50%' }} />
      <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 34% 30%, #fefce8 0%, #f0e8c0 30%, #c4b890 70%, #8a7f60 100%)', boxShadow: 'inset -4px -5px 10px rgba(70,60,40,0.4), inset 3px 3px 6px rgba(255,250,220,0.4), 0 0 20px rgba(254,252,232,0.35)' }}>
        <div style={{ position: 'absolute', width: '18%', height: '18%', top: '24%', left: '21%', borderRadius: '50%', background: 'rgba(110,95,70,0.4)' }} />
        <div style={{ position: 'absolute', width: '10%', height: '10%', top: '58%', left: '52%', borderRadius: '50%', background: 'rgba(110,95,70,0.35)' }} />
        <div style={{ position: 'absolute', width: '13%', height: '13%', top: '66%', left: '26%', borderRadius: '50%', background: 'rgba(110,95,70,0.35)' }} />
      </div>
    </div>
  );
}
