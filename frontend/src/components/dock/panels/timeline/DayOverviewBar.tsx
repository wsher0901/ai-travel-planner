'use client';

import { useState, useRef } from 'react';
import { type PlanItem } from '@/store/tripStore';

const ACTIVITY_COLORS: Record<string, string> = {
  sightseeing:   '#06b6d4',
  food:          '#fb923c',
  activity:      '#a78bfa',
  transport:     '#3b82f6',
  accommodation: '#818cf8',
  shopping:      '#ec4899',
  entertainment: '#ef4444',
  outdoor:       '#059669',
  wellness:      '#14b8a6',
  nightlife:     '#7c3aed',
  culture:       '#f97316',
};

// Full 24-hour day
const DAY_MINUTES = 1440;

// Sunrise / sunset — Phase 3 will replace with SunCalc
const SUNRISE_MIN = 6 * 60;   // 360 min → 25%
const SUNSET_MIN  = 20 * 60;  // 1200 min → 83.33%
const SUNRISE_PCT = (SUNRISE_MIN / DAY_MINUTES) * 100;
const SUNSET_PCT  = (SUNSET_MIN  / DAY_MINUTES) * 100;

const HOUR_LABELS = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm', '12am'];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hexToRgbStr(hex: string): string {
  if (!hex.startsWith('#')) return '255,255,255';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

interface DayOverviewBarProps {
  items: PlanItem[];
  hoveredActivityId?: string | null;
  onHoverActivity?: (id: string | null) => void;
}

export default function DayOverviewBar({ items, hoveredActivityId, onHoverActivity }: DayOverviewBarProps) {
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const timedItems = items.filter((i) => i.start_time);

  return (
    <div
      style={{
        padding: '14px 20px 10px 20px',
        borderTop: '1px solid rgba(6,182,212,0.08)',
        backgroundColor: 'rgba(6,182,212,0.02)',
        position: 'relative',
      }}
    >
      {/* Bar container — marginTop leaves room for the floating sunrise/sunset indicators */}
      <div ref={containerRef} style={{ position: 'relative', height: 42, overflow: 'visible', marginTop: 22 }}>

        {/* BACKGROUND GRADIENT — day/night temporal context */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 42,
            borderRadius: 10,
            zIndex: 0,
            opacity: 0.85,
            pointerEvents: 'none',
            background: `linear-gradient(90deg,
              rgba(15,10,30,0.92) 0%,
              rgba(15,10,30,0.92) 20%,
              rgba(88,28,135,0.5) 24%,
              rgba(234,88,12,0.55) 28%,
              rgba(251,146,60,0.5) 32%,
              rgba(253,224,71,0.35) 36%,
              rgba(254,249,195,0.25) 42%,
              rgba(254,249,195,0.25) 62%,
              rgba(253,224,71,0.3) 68%,
              rgba(251,146,60,0.5) 74%,
              rgba(234,88,12,0.5) 78%,
              rgba(139,92,246,0.45) 83%,
              rgba(67,56,202,0.55) 88%,
              rgba(15,10,30,0.92) 100%
            )`,
          }}
        />

        {/* TIMELINE BASE LINE */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.12) 10%, rgba(6,182,212,0.12) 90%, transparent 100%)',
            transform: 'translateY(-50%)',
            zIndex: 1,
          }}
        />

        {/* SUNRISE INDICATOR — pinned at actual time position */}
        <div
          style={{
            position:      'absolute',
            top:           -20,
            left:          `${SUNRISE_PCT}%`,
            transform:     'translateX(-50%)',
            display:       'flex',
            alignItems:    'center',
            gap:           3,
            zIndex:        10,
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(251,191,36,0.9)' }}>☀</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(251,191,36,0.8)', fontFamily: 'monospace' }}>6:00 AM</span>
        </div>

        {/* SUNSET INDICATOR — pinned at actual time position */}
        <div
          style={{
            position:      'absolute',
            top:           -20,
            left:          `${SUNSET_PCT}%`,
            transform:     'translateX(-50%)',
            display:       'flex',
            alignItems:    'center',
            gap:           3,
            zIndex:        10,
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 11, color: 'rgba(168,85,247,0.9)' }}>🌙</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(168,85,247,0.8)', fontFamily: 'monospace' }}>8:00 PM</span>
        </div>

        {/* Activity blocks */}
        {timedItems.map((item, idx) => {
          const startMins      = timeToMinutes(item.start_time!);
          const durMins        = item.duration_minutes ?? 60;
          const endMins        = item.end_time ? timeToMinutes(item.end_time) : startMins + durMins;
          const left           = (startMins / DAY_MINUTES) * 100;
          const width          = Math.max((durMins / DAY_MINUTES) * 100, 0.5);
          const hexColor       = ACTIVITY_COLORS[item.activity_type];
          const blockKey       = item.id ? String(item.id) : `${item.day_number}-${item.sort_order}`;
          const isDirectHover  = hoveredBlock === blockKey;
          const isExternalHover = hoveredActivityId === blockKey;
          const isActive       = isDirectHover || isExternalHover;
          const endTimeStr     = minutesToTimeStr(endMins);

          void idx;

          const rgb = hexColor ? hexToRgbStr(hexColor) : null;

          const normalBorder = rgb ? `2px solid rgba(${rgb},0.7)` : '2px solid rgba(255,255,255,0.2)';
          const hoverBorder  = rgb ? `2px solid rgba(${rgb},1)`   : '2px solid rgba(255,255,255,0.5)';
          const hoverShadow  = rgb
            ? `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px rgba(${rgb},0.25)`
            : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 14px rgba(255,255,255,0.1)';

          const containerWidth  = containerRef.current?.offsetWidth ?? 400;
          const blockPixelWidth = (width / 100) * containerWidth;
          const showLabel       = blockPixelWidth > 50;
          const labelText       = item.title && item.title.length > 12
            ? item.title.slice(0, 12) + '...'
            : item.title ?? '';

          return (
            <div
              key={blockKey}
              style={{
                position:             'absolute',
                top:                  2,
                height:               38,
                left:                 `${left}%`,
                width:                `${width}%`,
                backgroundColor:      isActive ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.3)',
                backdropFilter:       'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderRadius:         8,
                border:               isActive ? hoverBorder : normalBorder,
                boxShadow:            isActive ? hoverShadow : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                cursor:               'pointer',
                transition:           'all 200ms ease',
                zIndex:               3,
                transform:            isActive ? 'scaleY(1.08)' : 'none',
              }}
              onMouseEnter={() => {
                setHoveredBlock(blockKey);
                onHoverActivity?.(blockKey);
              }}
              onMouseLeave={() => {
                setHoveredBlock(null);
                onHoverActivity?.(null);
              }}
            >
              {/* Inner label */}
              {showLabel && (
                <div
                  style={{
                    position:     'absolute',
                    top:          '50%',
                    left:         6,
                    transform:    'translateY(-50%)',
                    fontSize:     10,
                    fontWeight:   600,
                    color:        'rgba(255,255,255,0.9)',
                    textShadow:   '0 1px 4px rgba(0,0,0,0.8)',
                    whiteSpace:   'nowrap',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth:     'calc(100% - 12px)',
                    fontFamily:   'var(--font-sora)',
                    pointerEvents:'none',
                    zIndex:       4,
                  }}
                >
                  {labelText}
                </div>
              )}

              {/* Tooltip */}
              {isActive && (
                <div
                  style={{
                    position:        'absolute',
                    bottom:          'calc(100% + 6px)',
                    left:            '50%',
                    transform:       'translateX(-50%)',
                    backgroundColor: 'rgba(12,15,22,0.95)',
                    border:          '1px solid rgba(6,182,212,0.2)',
                    borderRadius:    8,
                    padding:         '5px 10px',
                    fontSize:        11,
                    color:           'rgba(255,255,255,0.85)',
                    fontFamily:      'var(--font-sora)',
                    whiteSpace:      'nowrap',
                    pointerEvents:   'none',
                    zIndex:          20,
                  }}
                >
                  {item.title} · {item.start_time}-{endTimeStr}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {timedItems.length === 0 && (
          <div
            style={{
              position:        'absolute',
              top: 0, right: 0, bottom: 0, left: 0,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        11,
              color:           'rgba(255,255,255,0.15)',
              fontFamily:      'var(--font-sora)',
              zIndex:          3,
            }}
          >
            No activities
          </div>
        )}
      </div>

      {/* Hour labels */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {HOUR_LABELS.map((label, i) => (
            <span
              key={i}
              style={{
                fontSize:      13,
                fontWeight:    500,
                color:         'rgba(255,255,255,0.65)',
                fontFamily:    'monospace',
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
