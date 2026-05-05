'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  CloudRain,
  Snowflake,
  Sunrise,
  Sunset,
  type LucideProps,
} from 'lucide-react';
import { DAY_MINUTES } from '@/lib/timeAxis';
import { hourToTimelinePercent, minuteToTimelinePercent } from '@/lib/timelineInset';
import { useTripStore } from '@/store/tripStore';
import { useTripWeather } from '@/hooks/useTripWeather';
import { isRainTier, isSnowTier, mapToConditionTier } from '@/lib/weather/mapping';
import type { DayWeather, WeatherCondition } from '@/lib/weather/types';

const ICON_SIZE = 18;
const GAP = 5;
// Horizontal collision threshold = icon center-to-center distance below which
// two icons overlap. Label is below icon so only the icon footprint matters.
const COLLISION_DETECT_PX = ICON_SIZE + GAP;
// How far right to nudge the yielding icon to clear the blocker.
const SIDE_BY_SIDE_GAP_PX = ICON_SIZE + GAP;

const SUNRISE_COLOR = '#fbbf24';
const SUNSET_COLOR = '#f97316';
const RAIN_COLOR = '#06b6d4';
const SNOW_COLOR = '#a5b4fc';

interface StaticAnnotation {
  id: string;
  Icon: ComponentType<LucideProps>;
  color: string;
  label: string;
  time: string;
  truePercent: number;
}

function formatClock(date: Date): string {
  const h24 = date.getHours();
  const m = date.getMinutes();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatHourClock(hour: number): string {
  const h24 = ((hour % 24) + 24) % 24;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:00 ${period}`;
}

function formatClockCompact(date: Date): string {
  const h12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  return `${h12}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatHourClockCompact(hour: number): string {
  const h24 = ((hour % 24) + 24) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:00`;
}

function dateMinuteToPercent(d: Date): number {
  return minuteToTimelinePercent(d.getHours() * 60 + d.getMinutes());
}

interface PrecipTransition {
  hour: number;
  mode: 'rain' | 'snow';
}

function detectPrecipTransitions(day: DayWeather): PrecipTransition[] {
  const out: PrecipTransition[] = [];
  const sorted = [...day.hourly].sort((a, b) => a.hour - b.hour);
  let prevTier: WeatherCondition | null = null;
  for (const h of sorted) {
    const tier = mapToConditionTier(h);
    const isRainNow = isRainTier(tier) || tier === 'thunderstorm';
    const isSnowNow = isSnowTier(tier);
    const wasRain = prevTier !== null && (isRainTier(prevTier) || prevTier === 'thunderstorm');
    const wasSnow = prevTier !== null && isSnowTier(prevTier);
    if (isRainNow && !wasRain) out.push({ hour: h.hour, mode: 'rain' });
    if (isSnowNow && !wasSnow) out.push({ hour: h.hour, mode: 'snow' });
    prevTier = tier;
  }
  return out;
}

interface Props {
  date: string;
  // x-position of the "now" walker as a percentage of strip width (0–100).
  // Null when not today — collision math skips walker entirely.
  walkerXPercent: number | null;
}

export default function AnnotationStrip({ date, walkerXPercent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const tripId = useTripStore((s) => s.tripPlan?.id ?? null);
  const weather = useTripWeather(tripId);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dayWeather = weather.daysData.get(date) ?? null;

  const annotations: StaticAnnotation[] = useMemo(() => {
    if (!dayWeather) return [];
    const out: StaticAnnotation[] = [];
    const meta = dayWeather.daily;
    out.push({
      id: 'sunrise',
      Icon: Sunrise,
      color: SUNRISE_COLOR,
      label: 'Sunrise',
      time: formatClock(meta.sunrise),
      truePercent: dateMinuteToPercent(meta.sunrise),
    });
    out.push({
      id: 'sunset',
      Icon: Sunset,
      color: SUNSET_COLOR,
      label: 'Sunset',
      time: formatClock(meta.sunset),
      truePercent: dateMinuteToPercent(meta.sunset),
    });
    for (const t of detectPrecipTransitions(dayWeather)) {
      out.push({
        id: `${t.mode}-${t.hour}`,
        Icon: t.mode === 'snow' ? Snowflake : CloudRain,
        color: t.mode === 'snow' ? SNOW_COLOR : RAIN_COLOR,
        label: t.mode === 'snow' ? 'Snow begins' : 'Rain begins',
        time: formatHourClock(t.hour),
        truePercent: hourToTimelinePercent(t.hour),
      });
    }
    return out;
  }, [dayWeather]);

  // --- Collision resolution ---
  // Sort icons left-to-right by true position. Walker acts as a fixed blocker.
  // Each static yields rightward if it collides with its left neighbour OR with
  // the walker. Capped at 2 cascading shifts per icon (H3 leftmost-stable policy).

  const positions: Array<StaticAnnotation & { displayPercent: number; compact: boolean }> =
    useMemo(() => {
      if (containerWidth <= 0) {
        return annotations.map((a) => ({ ...a, displayPercent: a.truePercent, compact: false }));
      }

      const walkerPx = walkerXPercent !== null ? (walkerXPercent / 100) * containerWidth : null;

      // Sort left-to-right so cascade sweeps in one pass.
      const sorted = [...annotations].sort(
        (a, b) => a.truePercent - b.truePercent,
      );

      // displayPx tracks the resolved pixel center for each icon.
      const displayPx: number[] = sorted.map((a) => (a.truePercent / 100) * containerWidth);

      for (let i = 0; i < sorted.length; i++) {
        let shifts = 0;

        // Check against walker first (fixed point — never moves).
        // Yield away from walker: left icon goes left, right icon goes right.
        if (walkerPx !== null && Math.abs(displayPx[i] - walkerPx) < COLLISION_DETECT_PX) {
          displayPx[i] =
            displayPx[i] < walkerPx
              ? walkerPx - SIDE_BY_SIDE_GAP_PX
              : walkerPx + SIDE_BY_SIDE_GAP_PX;
          shifts++;
        }

        // Check against already-resolved left neighbours (leftmost-stable).
        // Break after each successful shift — one nudge per pass, no double-counting.
        for (let j = i - 1; j >= 0 && shifts < 2; j--) {
          if (Math.abs(displayPx[i] - displayPx[j]) < COLLISION_DETECT_PX) {
            displayPx[i] = displayPx[j] + SIDE_BY_SIDE_GAP_PX;
            shifts++;
            break;
          }
        }
      }

      // Compact time-format detection: adjacent pair within 60px whose AM/PM period
      // matches → strip suffix from both labels.
      const compactSet = new Set<number>();
      for (let i = 0; i < sorted.length - 1; i++) {
        const distPx = Math.abs(displayPx[i + 1] - displayPx[i]);
        if (distPx < 60) {
          const aTime = sorted[i].time;
          const bTime = sorted[i + 1].time;
          const aPeriod = aTime.slice(-2); // 'AM' or 'PM'
          const bPeriod = bTime.slice(-2);
          if (aPeriod === bPeriod) {
            compactSet.add(i);
            compactSet.add(i + 1);
          }
        }
      }

      // Re-map back to original annotation order for stable key rendering.
      return annotations.map((a) => {
        const si = sorted.findIndex((s) => s.id === a.id);
        const px = displayPx[si];
        return {
          ...a,
          displayPercent: (px / containerWidth) * 100,
          compact: compactSet.has(si),
        };
      });
    }, [annotations, containerWidth, walkerXPercent]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        zIndex: 10,
      }}
    >
      {positions.map((a) => {
        const displayTime = a.compact
          ? a.id.startsWith('sunrise') || a.id.startsWith('sunset')
            ? formatClockCompact(
                a.id === 'sunrise'
                  ? (dayWeather?.daily.sunrise ?? new Date())
                  : (dayWeather?.daily.sunset ?? new Date()),
              )
            : formatHourClockCompact(parseInt(a.id.split('-')[1] ?? '0', 10))
          : a.time;

        return (
          <AnnotationIcon
            key={a.id}
            Icon={a.Icon}
            displayPercent={a.displayPercent}
            color={a.color}
            label={a.label}
            time={displayTime}
            isHovered={hoveredId === a.id}
            onHoverStart={() => setHoveredId(a.id)}
            onHoverEnd={() => setHoveredId((prev) => (prev === a.id ? null : prev))}
            zIndex={2}
          />
        );
      })}
      <WeatherSourceIndicator />
    </div>
  );
}

function WeatherSourceIndicator() {
  const tripId = useTripStore((s) => s.tripPlan?.id ?? null);
  const { source, isUnavailable, isEstimate, isMockFallback } = useTripWeather(tripId);

  if (source === 'forecast') return null;

  const showUnavailable = isUnavailable || isMockFallback;
  const showEstimate = isEstimate && !showUnavailable;
  if (!showEstimate && !showUnavailable) return null;

  const Icon = showEstimate ? BarChart3 : AlertCircle;
  const label = showEstimate ? 'estimate' : 'unavailable';
  const tooltip = showEstimate
    ? 'Based on historical averages — actual weather may vary'
    : 'Weather data unavailable for this date';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        bottom: 2,
        right: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        pointerEvents: 'none',
        fontFamily: 'var(--font-sora)',
        fontSize: 9,
        letterSpacing: '0.04em',
        color: 'rgba(255,255,255,0.4)',
        zIndex: 4,
      }}
      title={tooltip}
    >
      <Icon size={10} strokeWidth={2} />
      <span>{label}</span>
    </motion.div>
  );
}

interface IconProps {
  Icon: ComponentType<LucideProps>;
  displayPercent: number;
  color: string;
  label: string;
  time: string;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  zIndex: number;
}

function AnnotationIcon({
  Icon,
  displayPercent,
  color,
  label,
  time,
  isHovered,
  onHoverStart,
  onHoverEnd,
  zIndex,
}: IconProps) {
  // Label centered below icon.
  const labelStyle: CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: GAP,
    fontFamily: 'var(--font-sora)',
    fontSize: 10,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
    color,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  };

  return (
    <motion.div
      initial={false}
      animate={{ left: `${displayPercent}%` }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      style={{
        position: 'absolute',
        top: '50%',
        x: -ICON_SIZE / 2,
        y: -ICON_SIZE / 2,
        width: ICON_SIZE,
        height: ICON_SIZE,
        zIndex: isHovered ? 100 : zIndex,
      }}
    >
      <Icon size={ICON_SIZE} strokeWidth={2} color={color} />
      <span style={labelStyle}>{time}</span>
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            left: ICON_SIZE / 2,
            top: 0,
            transform: 'translate(-50%, calc(-100% - 6px))',
            background: 'rgba(12,15,22,0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: 4,
            padding: '6px 10px',
            fontFamily: 'var(--font-sora)',
            fontSize: 11,
            lineHeight: 1,
            color: 'rgba(255,255,255,0.9)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        >
          {label} · {time}
        </div>
      )}
    </motion.div>
  );
}
