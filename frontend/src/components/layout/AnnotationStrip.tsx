'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { minuteToTimelinePercent } from '@/lib/timelineInset';
import { useTripStore } from '@/store/tripStore';
import { useTripWeather } from '@/hooks/useTripWeather';
import { mapToConditionTier } from '@/lib/weather/mapping';
import {
  GLYPH_COLORS,
  FoggyGlyph,
  RainGlyph,
  SnowGlyph,
  SunriseGlyph,
  SunsetGlyph,
  ThunderstormGlyph,
  type GlyphProps,
} from '@/components/sky/annotationGlyphs';
import type { DayWeather, WeatherCondition } from '@/lib/weather/types';

const ICON_SIZE = 26;
const GAP = 5;
const COLLISION_DETECT_PX = ICON_SIZE + GAP;
const SIDE_BY_SIDE_GAP_PX = ICON_SIZE + GAP;

// Minimum run length that warrants tick markers + connector. Shorter runs
// just show a midpoint glyph (same as a discrete event) to avoid
// cluttering the strip with tight tick pairs.
const TICK_MIN_DURATION_MIN = 45;

// ──────────────────────────────────────────────────────────────────────────
// Tier-run detection: group consecutive same-FAMILY samples into one run.
// Sub-tier transitions within the same family (e.g. moderate → heavy rain)
// don't break the run; only family changes do. Baseline tiers (sunny,
// partly-cloudy, overcast) emit no annotations.

type AnnotationFamily = 'rain' | 'snow' | 'thunderstorm' | 'foggy';

const TIER_FAMILY: Partial<Record<WeatherCondition, AnnotationFamily>> = {
  'light-rain':    'rain',
  'moderate-rain': 'rain',
  'heavy-rain':    'rain',
  'thunderstorm':  'thunderstorm',
  'light-snow':    'snow',
  'moderate-snow': 'snow',
  'heavy-snow':    'snow',
  'foggy':         'foggy',
};

function familyOf(tier: WeatherCondition): AnnotationFamily | null {
  return TIER_FAMILY[tier] ?? null;
}

interface TierRun {
  family: AnnotationFamily;
  // Sub-tier with the most samples in the run — drives intensity glyph
  // weight for rain/snow.
  dominantTier: WeatherCondition;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  // Per-sub-tier sample counts, retained so adjacent runs can be merged
  // and `dominantTier` re-derived via pickDominant on the combined counts.
  subTierCounts: Map<WeatherCondition, number>;
}

// Adjacent same-family runs separated by less than this gap collapse into
// one annotation. The diorama particle masks are unaffected; the merge is
// presentation-level, so the user sees ONE icon spanning the full span
// while the strip still shows the actual rain/snow gap accurately.
const RUN_MERGE_GAP_MIN = 90;

function pickDominant(counts: Map<WeatherCondition, number>): WeatherCondition {
  let best: WeatherCondition | null = null;
  let bestCount = -1;
  for (const [tier, count] of counts) {
    if (count > bestCount) { best = tier; bestCount = count; }
  }
  // counts is only populated when family is set, so a non-null result is
  // guaranteed at the call sites below; the fallback is unreachable.
  return best ?? 'foggy';
}

function detectTierRuns(day: DayWeather): TierRun[] {
  const sorted = [...day.hourly].sort((a, b) => a.hour - b.hour);
  if (sorted.length === 0) return [];

  const runs: TierRun[] = [];
  let currentFamily: AnnotationFamily | null = null;
  let runStartHour = 0;
  let lastSeenHour = 0;
  let counts = new Map<WeatherCondition, number>();

  const closeRun = (endHourExclusive: number) => {
    if (currentFamily === null) return;
    const startMinute = runStartHour * 60;
    const endMinute = endHourExclusive * 60;
    runs.push({
      family: currentFamily,
      dominantTier: pickDominant(counts),
      startMinute,
      endMinute,
      durationMinutes: endMinute - startMinute,
      subTierCounts: counts,
    });
  };

  for (const h of sorted) {
    const tier = mapToConditionTier(h);
    const family = familyOf(tier);

    if (family !== currentFamily) {
      // Close pending run at the START of this hour (== last sample hour + 1).
      closeRun(lastSeenHour + 1);
      currentFamily = family;
      runStartHour = h.hour;
      counts = new Map();
    }

    if (family !== null) {
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
    lastSeenHour = h.hour;
  }

  // Close trailing run.
  closeRun(lastSeenHour + 1);

  return mergeAdjacentRuns(runs, RUN_MERGE_GAP_MIN);
}

// Linear pass: when consecutive runs are the SAME family and separated by
// fewer than `gapThresholdMin` minutes, merge them into one. Sub-tier
// counts combine so `pickDominant` can re-evaluate which sub-tier
// dominates the merged span. After a merge we re-check the same index so
// a freshly-merged run can absorb its next neighbour.
function mergeAdjacentRuns(runs: TierRun[], gapThresholdMin: number): TierRun[] {
  if (runs.length < 2) return runs;
  const out = [...runs];
  let i = 0;
  while (i < out.length - 1) {
    const a = out[i];
    const b = out[i + 1];
    const gap = b.startMinute - a.endMinute;
    if (a.family === b.family && gap < gapThresholdMin) {
      const merged = new Map(a.subTierCounts);
      for (const [tier, count] of b.subTierCounts) {
        merged.set(tier, (merged.get(tier) ?? 0) + count);
      }
      out[i] = {
        family:           a.family,
        dominantTier:     pickDominant(merged),
        startMinute:      a.startMinute,
        endMinute:        b.endMinute,
        durationMinutes:  b.endMinute - a.startMinute,
        subTierCounts:    merged,
      };
      out.splice(i + 1, 1);
      // Stay at i so the merged run can fold in another adjacent run.
    } else {
      i++;
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-tier intensity → opacity for rain & snow glyphs. Bumped from the
// previous 0.65 / 0.85 / 1.0 ladder to 0.78 / 0.92 / 1.0 — at 26 px the
// filled silhouettes need higher opacity to read as "present" rather than
// "ghosted". Thunderstorm / foggy / events all render at full weight.

function intensityOpacity(tier: WeatherCondition): number {
  switch (tier) {
    case 'light-rain':
    case 'light-snow':
      return 0.78;
    case 'moderate-rain':
    case 'moderate-snow':
      return 0.92;
    case 'heavy-rain':
    case 'heavy-snow':
      return 1.0;
    default:
      return 1.0;
  }
}

function familyGlyph(family: AnnotationFamily): ComponentType<GlyphProps> {
  switch (family) {
    case 'rain':         return RainGlyph;
    case 'snow':         return SnowGlyph;
    case 'thunderstorm': return ThunderstormGlyph;
    case 'foggy':        return FoggyGlyph;
  }
}

function familyColor(family: AnnotationFamily): string {
  switch (family) {
    case 'rain':         return GLYPH_COLORS.rain;
    case 'snow':         return GLYPH_COLORS.snow;
    case 'thunderstorm': return GLYPH_COLORS.thunderstorm;
    case 'foggy':        return GLYPH_COLORS.foggy;
  }
}

function familyLabel(family: AnnotationFamily): string {
  switch (family) {
    case 'rain':         return 'Rain';
    case 'snow':         return 'Snow';
    case 'thunderstorm': return 'Storm';
    case 'foggy':        return 'Fog';
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Time formatting (preserved from prior implementation).

function formatClock(date: Date): string {
  const h24 = date.getHours();
  const m = date.getMinutes();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatMinuteClock(minute: number): string {
  const total = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatClockCompact(date: Date): string {
  const h12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  return `${h12}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatMinuteClockCompact(minute: number): string {
  const total = ((Math.round(minute) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function dateMinuteToPercent(d: Date): number {
  return minuteToTimelinePercent(d.getHours() * 60 + d.getMinutes());
}

// ──────────────────────────────────────────────────────────────────────────
// Annotation data model

type Annotation =
  | {
      id: string;
      kind: 'event';
      Glyph: ComponentType<GlyphProps>;
      color: string;
      label: string;
      time: string;
      // Position used both for rendering and for collision math.
      truePercent: number;
      // Compact time for short adjacent labels (no AM/PM suffix).
      timeCompact: string;
    }
  | {
      id: string;
      kind: 'run';
      family: AnnotationFamily;
      Glyph: ComponentType<GlyphProps>;
      color: string;
      label: string;
      // `time` / `timeCompact` carry the run's START time. Used as the
      // single label below the glyph for short runs (< TICK_MIN_DURATION_MIN);
      // for longer runs RunDecoration renders dual labels at the tick
      // positions and AnnotationIcon suppresses the inline label.
      time: string;
      timeCompact: string;
      // Run end time, used by RunDecoration for the dual-label layout.
      endTime: string;
      truePercent: number;     // mid position (collision target)
      startPercent: number;
      endPercent: number;
      durationMinutes: number;
      glyphOpacity: number;
    };

// ──────────────────────────────────────────────────────────────────────────

interface Props {
  date: string;
}

export default function AnnotationStrip({ date }: Props) {
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

  const annotations: Annotation[] = useMemo(() => {
    if (!dayWeather) return [];
    const out: Annotation[] = [];
    const meta = dayWeather.daily;

    // Sunrise / sunset — discrete events.
    out.push({
      id: 'sunrise',
      kind: 'event',
      Glyph: SunriseGlyph,
      color: GLYPH_COLORS.sunrise,
      label: 'Sunrise',
      time: formatClock(meta.sunrise),
      timeCompact: formatClockCompact(meta.sunrise),
      truePercent: dateMinuteToPercent(meta.sunrise),
    });
    out.push({
      id: 'sunset',
      kind: 'event',
      Glyph: SunsetGlyph,
      color: GLYPH_COLORS.sunset,
      label: 'Sunset',
      time: formatClock(meta.sunset),
      timeCompact: formatClockCompact(meta.sunset),
      truePercent: dateMinuteToPercent(meta.sunset),
    });

    // Tier runs — one annotation per consecutive precipitation/fog block.
    for (const run of detectTierRuns(dayWeather)) {
      const Glyph = familyGlyph(run.family);
      const color = familyColor(run.family);
      const midMinute = (run.startMinute + run.endMinute) / 2;
      out.push({
        id: `${run.family}-${run.startMinute}`,
        kind: 'run',
        family: run.family,
        Glyph,
        color,
        label: familyLabel(run.family),
        time: formatMinuteClock(run.startMinute),
        timeCompact: formatMinuteClockCompact(run.startMinute),
        endTime: formatMinuteClockCompact(run.endMinute),
        truePercent: minuteToTimelinePercent(midMinute),
        startPercent: minuteToTimelinePercent(run.startMinute),
        endPercent: minuteToTimelinePercent(run.endMinute),
        durationMinutes: run.durationMinutes,
        glyphOpacity: intensityOpacity(run.dominantTier),
      });
    }

    return out;
  }, [dayWeather]);

  // ──────────────────────────────────────────────────────────────────────
  // Collision resolution. Glyph midpoints shift right when they collide
  // with a left neighbour. Tick markers (start/end of a run) sit at exact
  // run boundaries and are NOT subject to collision.

  const positions: Array<Annotation & { displayPercent: number; compact: boolean }> =
    useMemo(() => {
      if (containerWidth <= 0) {
        return annotations.map((a) => ({ ...a, displayPercent: a.truePercent, compact: false }));
      }

      const sorted = [...annotations].sort((a, b) => a.truePercent - b.truePercent);
      const displayPx: number[] = sorted.map((a) => (a.truePercent / 100) * containerWidth);

      for (let i = 0; i < sorted.length; i++) {
        let shifts = 0;

        for (let j = i - 1; j >= 0 && shifts < 2; j--) {
          if (Math.abs(displayPx[i] - displayPx[j]) < COLLISION_DETECT_PX) {
            displayPx[i] = displayPx[j] + SIDE_BY_SIDE_GAP_PX;
            shifts++;
            break;
          }
        }
      }

      // Compact time format when an adjacent pair is within 60 px AND shares
      // an AM/PM period — strips the suffix from both labels.
      const compactSet = new Set<number>();
      for (let i = 0; i < sorted.length - 1; i++) {
        const distPx = Math.abs(displayPx[i + 1] - displayPx[i]);
        if (distPx < 60) {
          const aPeriod = sorted[i].time.slice(-2);
          const bPeriod = sorted[i + 1].time.slice(-2);
          if (aPeriod === bPeriod) {
            compactSet.add(i);
            compactSet.add(i + 1);
          }
        }
      }

      // Map back to original annotation order so React keys are stable.
      return annotations.map((a) => {
        const si = sorted.findIndex((s) => s.id === a.id);
        const px = displayPx[si];
        return {
          ...a,
          displayPercent: (px / containerWidth) * 100,
          compact: compactSet.has(si),
        };
      });
    }, [annotations, containerWidth]);

  // Decoration (ticks + connector) — runs ≥ TICK_MIN_DURATION_MIN only.
  const tickRuns = useMemo(
    () => annotations.filter(
      (a): a is Extract<Annotation, { kind: 'run' }> =>
        a.kind === 'run' && a.durationMinutes >= TICK_MIN_DURATION_MIN,
    ),
    [annotations],
  );

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
      {/* Decoration layer — start tick + connector + end tick for long runs. */}
      {tickRuns.map((run) => (
        <RunDecoration key={`deco-${run.id}`} run={run} />
      ))}

      {/* Glyph layer — collision-adjusted, hover-capable. */}
      {positions.map((a) => {
        const displayTime = a.compact ? a.timeCompact : a.time;
        return (
          <AnnotationIcon
            key={a.id}
            annotation={a}
            displayPercent={a.displayPercent}
            displayTime={displayTime}
            isHovered={hoveredId === a.id}
            onHoverStart={() => setHoveredId(a.id)}
            onHoverEnd={() => setHoveredId((prev) => (prev === a.id ? null : prev))}
          />
        );
      })}

      <WeatherSourceIndicator />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

interface RunDecorationProps {
  run: Extract<Annotation, { kind: 'run' }>;
}

function RunDecoration({ run }: RunDecorationProps) {
  // Wrapper establishes `color: run.color`; ticks + connector + labels
  // inherit via `currentColor` so a future palette change only needs to
  // update the wrapper.
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        color: run.color,
      }}
    >
      {/* Connector — faint horizontal line between start and end ticks. */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${run.startPercent}%`,
          width: `${Math.max(0, run.endPercent - run.startPercent)}%`,
          height: 1,
          background: 'currentColor',
          opacity: 0.35,
          transform: 'translateY(-50%)',
        }}
      />
      {/* Start + end ticks */}
      <RunTick percent={run.startPercent} />
      <RunTick percent={run.endPercent} />
      {/* Boundary time labels — start at left tick, end at right tick. The
          translate(-50%, ...) horizontally centers each label on its tick;
          the y offset matches AnnotationIcon's label so all labels sit on
          the same baseline below the strip. */}
      <RunTimeLabel percent={run.startPercent} time={run.timeCompact} />
      <RunTimeLabel percent={run.endPercent}   time={run.endTime} />
    </div>
  );
}

function RunTick({ percent }: { percent: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: `${percent}%`,
        width: 1,
        height: ICON_SIZE,
        background: 'currentColor',
        opacity: 0.55,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

function RunTimeLabel({ percent, time }: { percent: number; time: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        top: '50%',
        left: `${percent}%`,
        transform: `translate(-50%, ${ICON_SIZE / 2 + GAP}px)`,
        fontFamily: 'var(--font-sora)',
        fontSize: 10,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.02em',
        color: 'currentColor',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {time}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────

interface AnnotationIconProps {
  annotation: Annotation;
  displayPercent: number;
  displayTime: string;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

function AnnotationIcon({
  annotation,
  displayPercent,
  displayTime,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: AnnotationIconProps) {
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
    color: annotation.color,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  };

  const Glyph = annotation.Glyph;
  const glyphProps: GlyphProps =
    annotation.kind === 'run' ? { opacity: annotation.glyphOpacity } : {};

  // Long runs (≥ TICK_MIN_DURATION_MIN) get start + end labels at the tick
  // positions via RunDecoration; suppressing the inline label here avoids
  // a third midpoint label and keeps the strip readable.
  const showInlineLabel =
    !(annotation.kind === 'run' && annotation.durationMinutes >= TICK_MIN_DURATION_MIN);

  // Tooltip text — runs include duration; events show name + time only.
  const tooltipText =
    annotation.kind === 'run'
      ? `${annotation.label} · ${formatDuration(annotation.durationMinutes)} · starts ${annotation.time}`
      : `${annotation.label} · ${annotation.time}`;

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
        color: annotation.color,
        zIndex: isHovered ? 100 : 2,
      }}
    >
      <Glyph {...glyphProps} />
      {showInlineLabel && <span style={labelStyle}>{displayTime}</span>}
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
          {tooltipText}
        </div>
      )}
    </motion.div>
  );
}
