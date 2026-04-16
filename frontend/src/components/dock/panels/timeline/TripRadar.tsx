'use client';

import { memo, useMemo, useEffect, useRef, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface PlanItem {
  date?: string | null;
  activity_type?: string;
  cost_estimate?: number;
  duration_minutes?: number;
  start_time?: string | null;
  end_time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sort_order?: number;
}

interface TripRadarProps {
  planItems: PlanItem[];
  tripStartDate: string;
  tripEndDate: string;
}

// ── Haversine helper ───────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const EARTH_R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Scoring functions ──────────────────────────────────────────────────────────
function scoreBudget(items: PlanItem[]): number {
  if (items.length === 0) return 50;
  const avg = items.reduce((s, i) => s + (i.cost_estimate ?? 0), 0) / items.length;
  if (avg < 15) return 90;
  if (avg < 30) return 70;
  if (avg < 60) return 50;
  return 30;
}

function scorePace(items: PlanItem[], start: string, end: string): number {
  const days = Math.max(
    1,
    Math.round(
      (new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) /
        86400000
    ) + 1
  );
  const avg = items.length / days;
  if (avg >= 2 && avg <= 3) return 90;
  if (avg === 4) return 70;
  return 40;
}

function scoreVariety(items: PlanItem[]): number {
  const types = new Set(items.map((i) => i.activity_type).filter(Boolean));
  if (types.size >= 4) return 90;
  if (types.size === 3) return 70;
  if (types.size === 2) return 50;
  return 30;
}

function scoreWalkability(items: PlanItem[]): number {
  const byDate = new Map<string, PlanItem[]>();
  items.forEach((item) => {
    if (!item.date) return;
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date)!.push(item);
  });

  let totalDist = 0;
  let count = 0;

  byDate.forEach((dayItems) => {
    const sorted = [...dayItems].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (
        a.latitude != null &&
        a.longitude != null &&
        b.latitude != null &&
        b.longitude != null
      ) {
        totalDist += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
        count++;
      }
    }
  });

  if (count === 0) return 70;
  const avg = totalDist / count;
  if (avg < 1) return 90;
  if (avg < 3) return 70;
  if (avg < 5) return 50;
  return 30;
}

function scoreCoverage(items: PlanItem[]): number {
  const byDate = new Map<string, PlanItem[]>();
  items.forEach((item) => {
    if (!item.date) return;
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date)!.push(item);
  });

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  let totalRatio = 0;
  let dayCount = 0;

  byDate.forEach((dayItems) => {
    const timed = dayItems.filter((i) => i.start_time);
    if (timed.length === 0) return;

    const sorted = [...timed].sort((a, b) => toMin(a.start_time!) - toMin(b.start_time!));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const firstMin = toMin(first.start_time!);
    const lastEndMin = last.end_time
      ? toMin(last.end_time)
      : toMin(last.start_time!) + (last.duration_minutes ?? 60);

    const daySpan = lastEndMin - firstMin;
    if (daySpan <= 0) return;

    const usedMin = dayItems.reduce((s, i) => s + (i.duration_minutes ?? 0), 0);
    totalRatio += usedMin / daySpan;
    dayCount++;
  });

  if (dayCount === 0) return 60;
  const avg = totalRatio / dayCount;
  if (avg >= 0.6 && avg <= 0.8) return 90;
  if (avg > 0.8) return 50;
  if (avg >= 0.4) return 70;
  return 40;
}

function scoreCulture(items: PlanItem[]): number {
  if (items.length === 0) return 50;
  const cultural = items.filter(
    (i) => i.activity_type === 'sightseeing' || i.activity_type === 'activity'
  ).length;
  const ratio = cultural / items.length;
  if (ratio >= 0.5) return 85;
  if (ratio >= 0.3) return 70;
  return 50;
}

// ── Improvement tips ───────────────────────────────────────────────────────────
function getTip(criteria: string, score: number): string {
  const tips: Record<string, Record<string, string>> = {
    Budget: {
      high: 'Great value! Your activities are budget-friendly.',
      mid: 'Moderate spending. Consider free alternatives for some activities.',
      low: 'High spend per activity. Look for free walking tours or parks.',
    },
    Pace: {
      high: 'Well-balanced day structure with room to breathe.',
      mid: 'Slightly busy. Consider dropping one activity per day.',
      low: 'Days feel rushed or too empty. Aim for 3 activities per day.',
    },
    Variety: {
      high: 'Great mix of experiences across different types.',
      mid: 'Decent variety. Try adding a different activity type.',
      low: 'Activities are too similar. Mix in food, culture, or nature.',
    },
    Walkability: {
      high: 'Everything is close together. Easy on the feet!',
      mid: 'Some transit needed. Consider clustering nearby activities.',
      low: 'Activities are far apart. Reorder by location to reduce travel.',
    },
    Coverage: {
      high: 'Good use of daylight hours without being overwhelming.',
      mid: 'Some gaps in the schedule. Add a café stop or short activity.',
      low: 'Too packed or too empty. Aim for 60–80% of waking hours.',
    },
    Culture: {
      high: 'Rich cultural immersion with local experiences.',
      mid: 'Add a museum, historic site, or local workshop.',
      low: 'Mostly food/transport. Include landmarks or cultural activities.',
    },
  };
  const level = score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low';
  return tips[criteria]?.[level] ?? '';
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
interface TooltipPayloadEntry {
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length || !label) return null;
  const score = payload[0].value;
  const tip = getTip(label, score);
  return (
    <div
      style={{
        backgroundColor: 'rgba(12,15,22,0.95)',
        border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 8,
        padding: '8px 12px',
        maxWidth: 220,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          fontFamily: 'var(--font-sora)',
          marginBottom: 2,
        }}
      >
        {label}: {score}/100
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.4,
        }}
      >
        {tip}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
function TripRadarInner({ planItems, tripStartDate, tripEndDate }: TripRadarProps) {
  const chartData = useMemo(() => {
    const budgetScore = scoreBudget(planItems);
    const paceScore = scorePace(planItems, tripStartDate, tripEndDate);
    const varietyScore = scoreVariety(planItems);
    const walkabilityScore = scoreWalkability(planItems);
    const coverageScore = scoreCoverage(planItems);
    const cultureScore = scoreCulture(planItems);
    return [
      { criteria: 'Budget', score: budgetScore, fullMark: 100 },
      { criteria: 'Pace', score: paceScore, fullMark: 100 },
      { criteria: 'Variety', score: varietyScore, fullMark: 100 },
      { criteria: 'Walkability', score: walkabilityScore, fullMark: 100 },
      { criteria: 'Coverage', score: coverageScore, fullMark: 100 },
      { criteria: 'Culture', score: cultureScore, fullMark: 100 },
    ];
  }, [planItems, tripStartDate, tripEndDate]);

  const overallScore = useMemo(
    () => Math.round(chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length),
    [chartData]
  );

  const prevScores = useRef<Record<string, number>>({});

  const deltas = useMemo(() => {
    const result: Record<string, number> = {};
    chartData.forEach(item => {
      const prev = prevScores.current[item.criteria];
      if (prev !== undefined && prev !== item.score) {
        result[item.criteria] = item.score - prev;
      }
    });
    return result;
  }, [chartData]);

  useEffect(() => {
    const scores: Record<string, number> = {};
    chartData.forEach(item => { scores[item.criteria] = item.score; });
    prevScores.current = scores;
  }, [chartData]);

  const [visibleDeltas, setVisibleDeltas] = useState<Record<string, number>>({});

  useEffect(() => {
    if (Object.keys(deltas).length > 0) {
      setVisibleDeltas(deltas);
      const timer = setTimeout(() => setVisibleDeltas({}), 3000);
      return () => clearTimeout(timer);
    }
  }, [deltas]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        gap: 0,
        padding: 0,
        paddingTop: 0,
        marginTop: 0,
      }}
    >
      {/* Trip score */}
      <div style={{ textAlign: 'center', marginBottom: 0, lineHeight: 1 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)',
            fontFamily: 'var(--font-sora)',
            marginBottom: 0,
          }}
        >
          TRIP SCORE
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: 'rgb(245,158,11)',
              fontFamily: 'var(--font-sora)',
              lineHeight: 1,
            }}
          >
            {overallScore}
          </span>
          {(() => {
            const totalDelta = Object.values(visibleDeltas).reduce((s, d) => s + d, 0);
            if (totalDelta === 0) return null;
            return (
              <span style={{ fontSize: 16, fontWeight: 600, color: totalDelta > 0 ? '#22c55e' : '#f87171' }}>
                {totalDelta > 0 ? '+' : ''}{totalDelta}
              </span>
            );
          })()}
        </div>
        <div
          style={{
            width: 32,
            height: 2,
            backgroundColor: 'rgba(245,158,11,0.3)',
            margin: '2px auto 0',
            borderRadius: 1,
          }}
        />
      </div>

      {/* Radar chart */}
      <ResponsiveContainer width="100%" height={480}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="90%">
          <Tooltip
            cursor={false}
            content={<CustomTooltip />}
          />
          <PolarGrid
            stroke="rgba(6,182,212,0.1)"
            radialLines={false}
          />
          <PolarAngleAxis
            dataKey="criteria"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tick={(props: any) => {
              const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
              const item = chartData.find((d) => d.criteria === payload.value);
              const score = item?.score ?? 0;
              return (
                <g>
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fontSize={12}
                    fill="rgba(255,255,255,0.5)"
                    fontFamily="var(--font-sora)"
                    fontWeight={500}
                  >
                    {payload.value}
                  </text>
                  <text
                    x={x}
                    y={y + 15}
                    textAnchor="middle"
                    fontSize={14}
                    fill="rgb(245,158,11)"
                    fontFamily="var(--font-sora)"
                    fontWeight={700}
                  >
                    {score}
                  </text>
                  {visibleDeltas[payload.value] && (
                    <text
                      x={x}
                      y={y + 24}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={700}
                      fontFamily="var(--font-sora)"
                      fill={visibleDeltas[payload.value] > 0 ? '#22c55e' : '#f87171'}
                    >
                      {visibleDeltas[payload.value] > 0 ? '+' : ''}{visibleDeltas[payload.value]}
                    </text>
                  )}
                </g>
              );
            }}
          />
          <Radar
            dataKey="score"
            fill="rgba(245,158,11,0.12)"
            fillOpacity={1}
            stroke="rgba(245,158,11,0.6)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'rgb(245,158,11)', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: 'rgb(245,158,11)', stroke: 'rgba(245,158,11,0.3)', strokeWidth: 3 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

const TripRadar = memo(TripRadarInner);
export default TripRadar;
