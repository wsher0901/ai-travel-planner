'use client';

interface Props {
  leftPercent: number;
  topPx?: number;
  size?: number;
  variant?: 'full' | 'rising' | 'setting';
  opacity?: number;
}

export default function Sun({ leftPercent, topPx = 0, size = 48, variant = 'full', opacity = 1 }: Props) {
  if (variant === 'rising' || variant === 'setting') {
    const disc = variant === 'setting'
      ? 'radial-gradient(circle at 40% 35%, #fff0a8 0%, #ffa848 25%, #e85820 60%, #a02810 90%)'
      : 'radial-gradient(circle at 40% 35%, #fff3b8 0%, #ffc560 25%, #ff8a3e 55%, #d03a18 85%, #8a1e08 100%)';
    return (
      <>
        <div style={{ position: 'absolute', left: `${leftPercent}%`, bottom: 10, transform: 'translateX(-50%)', width: size * 2.5, height: 60, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,150,60,0.55) 0%, transparent 65%)', filter: 'blur(6px)', zIndex: 4, opacity, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: `${leftPercent}%`, bottom: 18, transform: 'translateX(-50%)', width: size, height: size / 2, overflow: 'hidden', zIndex: 5, opacity, pointerEvents: 'none' }}>
          <div style={{ width: size, height: size, borderRadius: '50%', background: disc, boxShadow: 'inset -5px -6px 14px rgba(100,25,0,0.4), inset 4px 4px 10px rgba(255,240,180,0.5), 0 -6px 30px rgba(255,140,50,0.6)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16%', left: '22%', width: '25%', height: '16%', borderRadius: '50%', background: 'rgba(255,250,200,0.6)', filter: 'blur(2px)' }} />
          </div>
        </div>
      </>
    );
  }
  return (
    <div style={{ position: 'absolute', left: `${leftPercent}%`, top: topPx, transform: 'translateX(-50%)', zIndex: 6, opacity, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: -22, background: 'radial-gradient(circle, rgba(255,230,140,0.45) 0%, rgba(255,200,90,0.2) 35%, transparent 68%)', borderRadius: '50%', animation: 'skyPulse 5s ease-in-out infinite' }} />
      <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, #fffde8 0%, #fff0a8 20%, #ffd655 50%, #f5a423 85%, #d47a10 100%)', boxShadow: 'inset -4px -5px 10px rgba(180,100,0,0.3), inset 3px 3px 8px rgba(255,255,220,0.55), 0 0 22px rgba(255,200,80,0.45)' }}>
        <div style={{ position: 'absolute', top: '15%', left: '19%', width: '27%', height: '17%', borderRadius: '50%', background: 'rgba(255,255,240,0.7)', filter: 'blur(1.5px)' }} />
        <div style={{ position: 'absolute', top: '25%', left: '25%', width: '8%', height: '6%', borderRadius: '50%', background: 'rgba(255,255,255,0.95)' }} />
      </div>
    </div>
  );
}
