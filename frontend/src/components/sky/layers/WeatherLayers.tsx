'use client';
import { useMemo, useId } from 'react';
import { type WeatherSegment, type WeatherCondition } from '../types';
import Raindrop from '../assets/Raindrop';

interface Props { segments: WeatherSegment[]; }

function hourToPercent(h: number): number {
  return (h / 24) * 100;
}

export default function WeatherLayers({ segments }: Props) {
  return (
    <>
      {segments.map((seg) => {
        const left = hourToPercent(seg.startHour);
        const width = hourToPercent(seg.endHour - seg.startHour);
        return (
          <SegmentRenderer
            key={`${seg.startHour}-${seg.endHour}-${seg.condition}`}
            left={left}
            width={width}
            condition={seg.condition}
            startHour={seg.startHour}
            endHour={seg.endHour}
          />
        );
      })}
    </>
  );
}

interface SegmentProps {
  left: number;
  width: number;
  condition: WeatherCondition;
  startHour: number;
  endHour: number;
}

function SegmentRenderer({ left, width, condition, startHour, endHour }: SegmentProps) {
  // Stable unique id per instance — avoids SVG gradient id collisions
  const uid = useId().replace(/:/g, '-');

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0, bottom: 20,
    left: `${left}%`,
    width: `${width}%`,
    overflow: 'hidden',
    zIndex: 7,
    maskImage: 'linear-gradient(90deg, transparent 0%, black 20%, black 80%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 20%, black 80%, transparent 100%)',
    pointerEvents: 'none',
  };

  if (condition === 'sunny') return null;

  if (condition === 'cloudy' || condition === 'fog') {
    const tintColor = condition === 'fog'
      ? 'linear-gradient(180deg, rgba(180,185,195,0.45) 0%, rgba(140,148,160,0.35) 100%)'
      : 'linear-gradient(180deg, rgba(80,85,100,0.35) 0%, rgba(60,65,85,0.2) 100%)';
    const gradId = `c-upper-${uid}`;
    return (
      <div style={wrapperStyle}>
        <div style={{ position: 'absolute', inset: 0, background: tintColor }} />
        <svg style={{ position: 'absolute', top: 6, left: 0, width: '100%', height: 52 }} viewBox="0 0 400 52" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e4eaf0" />
              <stop offset="100%" stopColor="#8a96a8" />
            </linearGradient>
          </defs>
          <ellipse cx="40" cy="30" rx="34" ry="16" fill={`url(#${gradId})`} opacity="0.9" />
          <ellipse cx="110" cy="26" rx="42" ry="18" fill={`url(#${gradId})`} opacity="0.92" />
          <ellipse cx="185" cy="32" rx="40" ry="17" fill={`url(#${gradId})`} opacity="0.88" />
          <ellipse cx="260" cy="28" rx="44" ry="18" fill={`url(#${gradId})`} opacity="0.92" />
          <ellipse cx="335" cy="32" rx="40" ry="17" fill={`url(#${gradId})`} opacity="0.88" />
        </svg>
      </div>
    );
  }

  if (condition === 'rain-light' || condition === 'rain-heavy' || condition === 'thunderstorm') {
    const isHeavy = condition === 'rain-heavy' || condition === 'thunderstorm';
    const dropCount = isHeavy ? 30 : 18;
    const speed = isHeavy ? 0.6 : 0.9;
    const tint = condition === 'thunderstorm'
      ? 'linear-gradient(180deg, rgba(25,30,45,0.7) 0%, rgba(20,25,40,0.5) 100%)'
      : 'linear-gradient(180deg, rgba(40,55,80,0.55) 0%, rgba(30,45,70,0.3) 100%)';
    const gradId = `r-dark-${uid}`;

    // Stable raindrop positions keyed on segment identity
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const drops = useMemo(() => {
      const arr: { leftPercent: number; delay: number }[] = [];
      // Use a simple LCG seeded on startHour+endHour+dropCount for deterministic values
      let seed = (startHour * 1000 + endHour * 37 + dropCount * 7) | 0;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < dropCount; i++) {
        arr.push({ leftPercent: (i / dropCount) * 100 + rand() * 3, delay: rand() * 0.8 });
      }
      return arr;
    }, [startHour, endHour, dropCount]);

    return (
      <div style={wrapperStyle}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        <svg style={{ position: 'absolute', top: 4, left: 0, width: '100%', height: 44 }} viewBox="0 0 400 44" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8695a8" />
              <stop offset="100%" stopColor="#3a4656" />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy="26" rx="42" ry="18" fill={`url(#${gradId})`} />
          <ellipse cx="130" cy="22" rx="48" ry="20" fill={`url(#${gradId})`} />
          <ellipse cx="215" cy="26" rx="46" ry="19" fill={`url(#${gradId})`} />
          <ellipse cx="300" cy="22" rx="50" ry="20" fill={`url(#${gradId})`} />
          <ellipse cx="375" cy="26" rx="40" ry="18" fill={`url(#${gradId})`} />
        </svg>
        {drops.map((d, i) => (
          <Raindrop key={i} leftPercent={d.leftPercent} delay={d.delay} speed={speed} />
        ))}
      </div>
    );
  }

  if (condition === 'snow') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const flakes = useMemo(() => {
      const count = 22;
      let seed = (startHour * 999 + endHour * 43 + count * 11) | 0;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      return Array.from({ length: count }, (_, i) => ({
        left: (i / count) * 100 + rand() * 3,
        duration: 2.5 + rand() * 1.5,
        animDelay: rand() * 3,
      }));
    }, [startHour, endHour]);

    return (
      <div style={wrapperStyle}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(150,160,175,0.4) 0%, rgba(120,130,150,0.25) 100%)' }} />
        {flakes.map((f, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${f.left}%`,
            top: 0,
            width: 3, height: 3,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 0 3px #fff',
            animation: `skyFall ${f.duration}s linear infinite`,
            animationDelay: `${f.animDelay}s`,
            willChange: 'transform',
          }} />
        ))}
      </div>
    );
  }

  return null;
}
