'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { User, Sparkles, Zap, Activity, Calendar, DollarSign, Footprints } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useTripStore } from '@/store/tripStore';
import type { PlanItem } from '@/store/tripStore';
import { createClient } from '@/lib/supabase';
import ScrollArea from '@/components/ui/ScrollArea';

const eventSlideVariants = {
  enter: (direction: number) => ({ x: direction * 120, opacity: 0.2 }),
  center: { x: 0, opacity: 1 },
  exit:  (direction: number) => ({ x: direction * -120, opacity: 0 }),
}

const eventSlideTransition = {
  x:       { duration: 0.44, ease: [0.4, 0, 0.2, 1] as const },
  opacity: { duration: 0.22, ease: 'easeOut' as const },
}

const RADAR_DATA = [
  { axis: 'Budget', value: 78 },
  { axis: 'Pace', value: 65 },
  { axis: 'Variety', value: 82 },
  { axis: 'Walk', value: 60 },
  { axis: 'Cover', value: 70 },
  { axis: 'Culture', value: 75 },
];

// TODO: consolidate with PLACEHOLDER_SCORE/PLACEHOLDER_DELTA in TripSummaryPanel.tsx once real scoring is wired
const PLACEHOLDER_SCORE = 72;
const PLACEHOLDER_DELTA: number = 5;

interface PlanEvent {
  actor: 'human' | 'ai' | 'system';
  event_type: string;
  context_json: Record<string, unknown> | null;
  created_at: string;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function formatShortDate(iso: string): string {
  const clean = iso.slice(0, 10);
  const d = new Date(clean + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatActivitySubtitle(ctx: Record<string, unknown>): string | undefined {
  if (!ctx.date) return undefined;
  const dateStr = formatShortDate(ctx.date as string);
  if (!ctx.start_time) return dateStr;
  const start = formatTime12(ctx.start_time as string);
  if (!ctx.end_time) return `${dateStr} · ${start}`;
  const end = formatTime12(ctx.end_time as string);
  return `${dateStr} · ${start} – ${end}`;
}

function formatEventEntry(event: PlanEvent): { title: string; subtitle?: string } {
  const ctx = (event.context_json ?? {}) as Record<string, unknown>;
  switch (event.event_type) {
    case 'activity_added':
      return {
        title: `Added ${ctx.title ? (ctx.title as string) : 'activity'}`,
        subtitle: formatActivitySubtitle(ctx),
      };
    case 'activity_removed':
      return {
        title: `Removed ${ctx.title ? (ctx.title as string) : 'activity'}`,
        subtitle: ctx.date ? formatShortDate(ctx.date as string) : undefined,
      };
    case 'activity_modified':
    case 'activity_edited':
      return {
        title: `Updated ${ctx.title ? (ctx.title as string) : 'activity'}`,
        subtitle: formatActivitySubtitle(ctx),
      };
    case 'plan_generated':
      return {
        title: ctx.destination ? `Generated ${ctx.destination as string}` : 'Generated plan',
        subtitle:
          ctx.start_date && ctx.end_date
            ? `${formatShortDate(ctx.start_date as string)} – ${formatShortDate(ctx.end_date as string)}`
            : ctx.days
            ? `${ctx.days} days`
            : undefined,
      };
    case 'plan_modified':
      return { title: 'Modified plan' };
    default:
      return { title: event.event_type.replace(/_/g, ' ') };
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', JPY: '¥',
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeWalkingMinutes(items: PlanItem[]): number {
  const withCoords = items
    .filter((i) => typeof i.latitude === 'number' && typeof i.longitude === 'number')
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  if (withCoords.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 1; i < withCoords.length; i++) {
    totalMeters += haversine(
      withCoords[i - 1].latitude!,
      withCoords[i - 1].longitude!,
      withCoords[i].latitude!,
      withCoords[i].longitude!,
    );
  }
  return Math.round(totalMeters / 84);
}

function DayFactRow({ icon: Icon, iconColor, label, value }: {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 8px',
      borderRadius: 8,
      background: 'rgba(6,182,212,0.02)',
      border: '1px solid rgba(6,182,212,0.06)',
      minHeight: 40,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: `${iconColor}14`,
        border: `1px solid ${iconColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={13} color={iconColor} strokeWidth={2} />
      </div>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
        fontFamily: 'var(--font-sora)',
      }}>
        {label}
      </span>
      <span style={{
        marginLeft: 'auto',
        fontSize: 16, fontWeight: 600,
        color: 'rgba(255,255,255,0.92)',
        fontFamily: 'var(--font-geist-mono)',
      }}>
        {value}
      </span>
    </div>
  );
}

function PaceRow({ dots }: { dots: 1 | 2 | 3 }) {
  const dotColor =
    dots === 1 ? 'rgb(52,211,153)' :
    dots === 2 ? 'rgb(245,158,11)' :
                 'rgb(239,68,68)';
  const label = dots === 1 ? 'Light' : dots === 2 ? 'Moderate' : 'Packed';
  const paceValue = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 13, fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
        fontFamily: 'var(--font-sora)',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: n <= dots ? dotColor : 'rgba(255,255,255,0.15)',
            boxShadow: n <= dots ? `0 0 6px ${dotColor}88` : 'none',
          }} />
        ))}
      </div>
    </div>
  );
  return (
    <DayFactRow
      icon={Activity}
      iconColor="rgb(6,182,212)"
      label="Pace"
      value={paceValue}
    />
  );
}

export default function MetaColumn() {
  const { selectedDate, dateChangeDirection } = useUIStore();
  const { tripPlan, planItems } = useTripStore();
  const [events, setEvents] = useState<PlanEvent[]>([]);

  useEffect(() => {
    if (!tripPlan?.id) { setEvents([]); return; }
    let isMounted = true;
    const supabase = createClient();
    const tripId = tripPlan.id;

    (async () => {
      const { data: fetchedEvents, error } = await supabase
        .from('plan_events')
        .select('actor, event_type, context_json, created_at')
        .eq('trip_plan_id', tripId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[MetaColumn] plan_events query failed:', error);
        return;
      }

      const hasPlanGenerated = fetchedEvents?.some((e) => e.event_type === 'plan_generated') ?? false;

      if (!hasPlanGenerated) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (userId) {
          const backfillPayload: Record<string, unknown> = {
            user_id: userId,
            trip_plan_id: tripId,
            actor: 'ai',
            event_type: 'plan_generated',
            context_json: {
              destination: tripPlan.destination,
              start_date: tripPlan.start_date,
              end_date: tripPlan.end_date,
              backfilled: true,
            },
          };
          if (tripPlan.created_at) {
            backfillPayload.created_at = tripPlan.created_at;
          }
          const { error: insertErr } = await supabase
            .from('plan_events')
            .insert(backfillPayload);

          if (insertErr) {
            console.warn('[MetaColumn] plan_generated backfill failed:', insertErr);
          } else {
            const { data: refetch } = await supabase
              .from('plan_events')
              .select('actor, event_type, context_json, created_at')
              .eq('trip_plan_id', tripId)
              .order('created_at', { ascending: false })
              .limit(5);
            if (isMounted && refetch) setEvents(refetch as PlanEvent[]);
            return;
          }
        }
      }

      if (isMounted) setEvents((fetchedEvents ?? []) as PlanEvent[]);
    })();

    const channel = supabase
      .channel(`plan_events:${tripId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'plan_events', filter: `trip_plan_id=eq.${tripId}` },
        (payload) => {
          const newEvent = payload.new as PlanEvent;
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => `${e.created_at}:${e.event_type}`));
            const key = `${newEvent.created_at}:${newEvent.event_type}`;
            if (seen.has(key)) return prev;
            return [newEvent, ...prev].slice(0, 20);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'plan_events', filter: `trip_plan_id=eq.${tripId}` },
        (payload) => {
          const oldEvent = payload.old as PlanEvent;
          setEvents((prev) =>
            prev.filter(
              (e) => e.created_at !== oldEvent.created_at || e.event_type !== oldEvent.event_type
            )
          );
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[MetaColumn] realtime subscription error');
        }
      });

    return () => { isMounted = false; supabase.removeChannel(channel); };
  }, [tripPlan?.id]);

  const dayFacts = useMemo(() => {
    if (!selectedDate) return { count: 0, cost: 0, walkingMinutes: 0, paceDots: 1 as 1 | 2 | 3 };
    const items = planItems.filter((i) => i.date?.slice(0, 10) === selectedDate);
    const cost = items.reduce((s, i) => s + (i.cost_estimate ?? 0), 0);
    const walkingMinutes = computeWalkingMinutes(items);
    const count = items.length;
    const paceDots: 1 | 2 | 3 = count <= 1 ? 1 : count <= 4 ? 2 : 3;
    return { count, cost, walkingMinutes, paceDots };
  }, [planItems, selectedDate]);

  const currency = CURRENCY_SYMBOLS[planItems[0]?.currency ?? 'USD'] ?? '$';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'rgba(6,182,212,0.03)',
      border: '1px solid rgba(6,182,212,0.15)',
      borderRadius: 12,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden',
    }}>

      {/* ── DAY SUMMARY section ────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'var(--font-sora)',
          }}>
            Day Summary
          </span>

          <span style={{
            color: 'rgba(6,182,212,0.3)',
            fontSize: 10,
          }}>
            ·
          </span>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: 'var(--font-sora)',
              color: 'rgb(245,158,11)',
              lineHeight: 1,
              textShadow: '0 0 12px rgba(245,158,11,0.35)',
            }}>
              {PLACEHOLDER_SCORE}
            </span>
            <span style={{
              fontSize: 11,
              fontFamily: 'var(--font-geist-mono)',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.06em',
            }}>
              / 100
            </span>

            {typeof PLACEHOLDER_DELTA === 'number' && PLACEHOLDER_DELTA !== 0 && (
              <span style={{
                marginLeft: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: '2px 5px',
                borderRadius: 4,
                background: PLACEHOLDER_DELTA > 0
                  ? 'rgba(52,211,153,0.15)'
                  : 'rgba(239,68,68,0.15)',
                border: `1px solid ${PLACEHOLDER_DELTA > 0
                  ? 'rgba(52,211,153,0.45)'
                  : 'rgba(239,68,68,0.45)'}`,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-geist-mono)',
                color: PLACEHOLDER_DELTA > 0 ? 'rgb(52,211,153)' : 'rgb(239,68,68)',
              }}>
                <svg width="7" height="7" viewBox="0 0 8 8"
                  style={{ transform: PLACEHOLDER_DELTA > 0 ? 'none' : 'rotate(180deg)' }}>
                  <path d="M4 0 L8 6 L0 6 Z" fill="currentColor" />
                </svg>
                <span>{PLACEHOLDER_DELTA > 0 ? '+' : ''}{PLACEHOLDER_DELTA}</span>
              </span>
            )}
          </div>
        </div>

        {/* Horizontal row: radar left + day facts right */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'stretch',
            height: 178,
          }}
        >
          {/* LEFT: Radar */}
          <div style={{
            flex: '1.1 1 0',
            minWidth: 0,
            padding: 4,
            display: 'flex',
          }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height={170}>
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="78%"
                  data={RADAR_DATA}
                >
                  <PolarGrid stroke="rgba(6,182,212,0.15)" strokeWidth={1} />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{
                      fill: 'rgba(255,255,255,0.7)',
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'var(--font-sora)',
                      letterSpacing: '0.04em',
                    }}
                  />
                  <PolarRadiusAxis axisLine={false} tick={false} domain={[0, 100]} />
                  <Radar
                    dataKey="value"
                    stroke="rgb(245,158,11)"
                    strokeWidth={2}
                    fill="rgba(245,158,11,0.28)"
                    fillOpacity={1}
                    isAnimationActive={true}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RIGHT: Day Facts (four rows) */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: '0.9 1 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              justifyContent: 'center',
            }}
          >
            <DayFactRow
              icon={Calendar}
              iconColor="rgb(6,182,212)"
              label="Activities"
              value={dayFacts.count.toString()}
            />
            <DayFactRow
              icon={DollarSign}
              iconColor="rgb(245,158,11)"
              label="Cost"
              value={`${currency}${dayFacts.cost.toFixed(0)}`}
            />
            <DayFactRow
              icon={Footprints}
              iconColor="rgb(6,182,212)"
              label="Walking"
              value={`${dayFacts.walkingMinutes} min`}
            />
            <PaceRow dots={dayFacts.paceDots} />
          </motion.div>
        </motion.div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div style={{
        height: 1,
        flexShrink: 0,
        background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.12), transparent)',
        margin: '16px 0',
      }} />

      {/* ── RECENT CHANGES section ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.46, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--font-sora)',
          marginBottom: 8,
          flexShrink: 0,
        }}>
          RECENT CHANGES
        </div>

        <AnimatePresence mode="popLayout" custom={dateChangeDirection} initial={false}>
          <motion.div
            key={selectedDate ?? 'no-date'}
            custom={dateChangeDirection}
            variants={eventSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={eventSlideTransition}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
        <ScrollArea style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {(() => {
            const visibleEvents = events
              .filter((e) => {
                if (e.event_type === 'plan_generated') return false;
                const eventDate = e.context_json?.date as string | undefined;
                if (!eventDate) return false;
                return eventDate === selectedDate;
              })
              .slice(0, 5);
            return visibleEvents.length === 0 ? (
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
              padding: 10,
              fontFamily: 'var(--font-sora)',
            }}>
              No changes yet — your edits will appear here.
            </div>
          ) : visibleEvents.map((ev, idx) => {
            const isHuman = ev.actor === 'human';
            const isAI = ev.actor === 'ai';
            const bgColor = isHuman
              ? 'rgba(6,182,212,0.15)'
              : isAI
              ? 'rgba(245,158,11,0.15)'
              : 'rgba(167,139,250,0.15)';
            const fgColor = isHuman
              ? 'rgb(6,182,212)'
              : isAI
              ? 'rgb(245,158,11)'
              : 'rgb(167,139,250)';
            const icon = isHuman
              ? <User size={10} />
              : isAI
              ? <Sparkles size={10} />
              : <Zap size={10} />;
            const entry = formatEventEntry(ev);

            return (
              <div
                key={`${ev.created_at}:${ev.event_type}:${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(6,182,212,0.02)',
                  border: '1px solid rgba(6,182,212,0.05)',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: bgColor,
                  color: fgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {icon}
                </div>

                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.85)',
                    fontFamily: 'var(--font-sora)',
                    lineHeight: 1.35,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {entry.title}
                  </span>
                  {entry.subtitle && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.45)',
                      fontFamily: 'var(--font-geist-mono)',
                      letterSpacing: '0.04em',
                      lineHeight: 1.3,
                    }}>
                      {entry.subtitle}
                    </span>
                  )}
                </div>

                <span style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'var(--font-geist-mono)',
                  flexShrink: 0,
                  alignSelf: 'flex-start',
                  paddingTop: 1,
                }}>
                  {formatRelative(ev.created_at)}
                </span>
              </div>
            );
          })
          })()}
        </ScrollArea>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
