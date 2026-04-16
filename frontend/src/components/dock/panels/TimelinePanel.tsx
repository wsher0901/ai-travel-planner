'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Wallet, Sunrise, Footprints, Train, Car, Sparkles, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useTripStore, type PlanItem } from '@/store/tripStore';
import ActivityCard from '@/components/dock/panels/timeline/ActivityCard';
import DayOverviewBar from '@/components/dock/panels/timeline/DayOverviewBar';
import DayStrip from '@/components/dock/panels/timeline/DayStrip';
import TripRadar from '@/components/dock/panels/timeline/TripRadar';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', JPY: '¥',
};

function formatCost(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToAmPm(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${displayH}:00 ${period}`
    : `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

type TravelInfo = { mode: 'walk' | 'transit' | 'drive'; duration: string };

function estimateTravel(
  fromItem: { latitude?: number | null; longitude?: number | null },
  toItem: { latitude?: number | null; longitude?: number | null }
): TravelInfo {
  if (
    fromItem.latitude != null && fromItem.longitude != null &&
    toItem.latitude != null && toItem.longitude != null
  ) {
    const lat1 = fromItem.latitude;
    const lon1 = fromItem.longitude;
    const lat2 = toItem.latitude;
    const lon2 = toItem.longitude;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (km < 1) return { mode: 'walk', duration: Math.round(km * 12) + ' min walk' };
    if (km < 4) return { mode: 'walk', duration: Math.round(km * 12) + ' min walk' };
    if (km < 15) return { mode: 'transit', duration: Math.round(km * 3) + ' min metro' };
    return { mode: 'drive', duration: Math.round(km * 1.5) + ' min drive' };
  }
  return { mode: 'walk', duration: '~15 min' };
}

const TRAVEL_ICONS: Record<TravelInfo['mode'], React.ElementType> = {
  walk: Footprints,
  transit: Train,
  drive: Car,
};

export default function TimelinePanel() {
  const planItems    = useTripStore((s) => s.planItems);
  const tripPlan     = useTripStore((s) => s.tripPlan);
  const setPlanItems = useTripStore((s) => s.setPlanItems);

  const [selectedDate, setSelectedDate] = useState<string | null>(
    tripPlan?.start_date ?? null
  );
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [insertAfterSortOrder, setInsertAfterSortOrder] = useState(0);
  const [hoveredAddPos, setHoveredAddPos] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    activity_type: 'sightseeing',
    start_time: '',
    end_time: '',
    location_name: '',
    cost_estimate: '',
    priority: 'must_do',
    notes: '',
  });

  useEffect(() => {
    if (tripPlan?.start_date) {
      setSelectedDate(tripPlan.start_date);
    }
  }, [tripPlan?.start_date]);

  // ── Placeholder ────────────────────────────────────────────────────────────
  if (planItems.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
            filter: 'blur(40px)',
          }}
        />
        <motion.div
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Clock size={36} color="rgba(245,158,11,0.25)" />
        </motion.div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-sora)',
            marginTop: 16,
          }}
        >
          Timeline
        </p>
        <p
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.18)',
            fontFamily: 'var(--font-sora)',
            marginTop: 4,
          }}
        >
          Your day-by-day itinerary will appear here
        </p>
      </div>
    );
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const dayItems = planItems
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => a.sort_order - b.sort_order);

  const currency   = dayItems[0]?.currency || planItems[0]?.currency || 'USD';
  const startDate  = tripPlan?.start_date ?? planItems[0]?.date ?? '';
  const endDate    = tripPlan?.end_date   ?? planItems[planItems.length - 1]?.date ?? '';

  // Stat values
  const totalCost    = dayItems.reduce((sum, item) => sum + (item.cost_estimate ?? 0), 0);
  const totalMinutes = dayItems.reduce((sum, item) => sum + (item.duration_minutes ?? 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins  = totalMinutes % 60;
  const timeStr = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

  // Wake-up: 1 hour before first timed activity
  const firstTimedItem = dayItems.find((i) => i.start_time);
  const wakeUpLabel = firstTimedItem
    ? minutesToAmPm(timeToMinutes(firstTimedItem.start_time!) - 60)
    : '—';

  // Day number (1-indexed from trip start_date)
  const dayNumber = selectedDate && startDate
    ? Math.floor(
        (new Date(selectedDate + 'T00:00:00').getTime() -
          new Date(startDate + 'T00:00:00').getTime()) /
          86400000
      ) + 1
    : 1;

  // Compact date label: "Jun 6 (Sat)"
  const compactDateLabel = selectedDate
    ? (() => {
        const d = new Date(selectedDate + 'T00:00:00');
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const day = d.getDate();
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        return `${month} ${day} (${weekday})`;
      })()
    : '';

  void wakeUpLabel;
  void Wallet;
  void Sunrise;

  // ── Day Intelligence ───────────────────────────────────────────────────────
  // Total walking minutes from consecutive connectors
  const walkingMinutes = dayItems.slice(0, -1).reduce((sum, item, i) => {
    const travel = estimateTravel(item, dayItems[i + 1]);
    if (travel.mode !== 'walk') return sum;
    const match = travel.duration.match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) : 15);
  }, 0);
  const walkLabel = walkingMinutes > 0 ? `~${walkingMinutes} min` : '~15 min';

  // Day pace
  const activityCount = dayItems.length;
  const pace = activityCount <= 2 ? 'Relaxed' : activityCount <= 4 ? 'Moderate' : 'Packed';
  const paceDots = pace === 'Relaxed' ? 1 : pace === 'Moderate' ? 2 : 3;
  const paceDotColor = pace === 'Relaxed' ? '#22c55e' : pace === 'Moderate' ? 'rgb(245,158,11)' : '#f87171';

  // Free time between activities
  const timedDayItems = dayItems.filter((i) => i.start_time);
  const freeMinutes = timedDayItems.slice(0, -1).reduce((sum, item, i) => {
    const nextItem = timedDayItems[i + 1];
    const currEndMin = item.end_time
      ? timeToMinutes(item.end_time)
      : timeToMinutes(item.start_time!) + (item.duration_minutes ?? 60);
    const nextStartMin = timeToMinutes(nextItem.start_time!);
    const gap = nextStartMin - currEndMin;
    return sum + (gap > 0 ? gap : 0);
  }, 0);
  const freeLabel = freeMinutes >= 60
    ? `~${Math.round(freeMinutes / 60)}h free`
    : freeMinutes > 0
    ? `~${freeMinutes}m free`
    : 'Fully packed';

  // AI insight
  const foodItem = dayItems.find((i) => i.activity_type === 'food');
  const firstTimed = timedDayItems[0];
  const lastTimed  = timedDayItems[timedDayItems.length - 1];
  const daySpanMin = firstTimed && lastTimed
    ? (lastTimed.end_time
        ? timeToMinutes(lastTimed.end_time)
        : timeToMinutes(lastTimed.start_time!) + (lastTimed.duration_minutes ?? 60)
      ) - timeToMinutes(firstTimed.start_time!)
    : 0;
  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';

  let insightText: string;
  if (foodItem) {
    insightText = `Consider visiting ${foodItem.title} before the lunch rush — popular spots are typically less crowded before 11am.`;
  } else if (firstTimed && lastTimed && daySpanMin >= 600) {
    const lastEnd = lastTimed.end_time ?? minutesToAmPm(timeToMinutes(lastTimed.start_time!) + (lastTimed.duration_minutes ?? 60));
    insightText = `Your day runs from ${firstTimed.start_time} to ${lastEnd}. Consider a rest break around 4pm between activities.`;
  } else if (totalCost > 100) {
    const cheapest = [...dayItems].sort((a, b) => (a.cost_estimate ?? 0) - (b.cost_estimate ?? 0))[0];
    insightText = `This is a high-spend day at ${currencySymbol}${Math.round(totalCost)}. ${cheapest?.title ?? 'One activity'} is budget-friendly if you need to balance costs.`;
  } else {
    insightText = 'Tip: The activities on this day are within walking distance of each other. Comfortable shoes recommended!';
  }

  async function handleAddActivity() {
    if (!formData.title || !tripPlan) return;
    const startMins = formData.start_time ? timeToMinutes(formData.start_time) : null;
    const endMins   = formData.end_time   ? timeToMinutes(formData.end_time)   : null;
    const durationMins = (startMins !== null && endMins !== null && endMins > startMins)
      ? endMins - startMins : 60;
    const timeSlot = startMins !== null
      ? startMins < 12 * 60 ? 'morning' : startMins < 17 * 60 ? 'afternoon' : 'evening'
      : 'morning';
    const newItem = {
      trip_id:        tripPlan.id,
      day_number:     dayNumber,
      date:           selectedDate,
      time_slot:      timeSlot,
      activity_type:  formData.activity_type,
      title:          formData.title,
      location_name:  formData.location_name,
      cost_estimate:  parseFloat(formData.cost_estimate) || 0,
      duration_minutes: durationMins,
      notes:          formData.notes,
      sort_order:     insertAfterSortOrder + 0.5,
      priority:       formData.priority,
      start_time:     formData.start_time || null,
      end_time:       formData.end_time   || null,
    };
    const supabase = createClient();
    const { data, error } = await supabase.from('plan_items').insert(newItem).select().single();
    if (!error && data) {
      const updatedItems = [...planItems, data as PlanItem]
        .sort((a, b) => {
          if (a.date !== b.date) return (a.date ?? '').localeCompare(b.date ?? '');
          return a.sort_order - b.sort_order;
        });
      setPlanItems(updatedItems);
    }
    setShowAddDialog(false);
    setFormData({ title: '', activity_type: 'sightseeing', start_time: '', end_time: '', location_name: '', cost_estimate: '', priority: 'must_do', notes: '' });
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#0c0f16',
        position: 'relative',
      }}
    >
      {/* ── GRID OVERLAY ── */}
      <div
        className="jarvis-grid"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.4,
        }}
      />

      {/* ── 1. HEADER ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flexShrink: 0,
          padding: '10px 20px',
          background: 'linear-gradient(180deg, rgba(245,158,11,0.04) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* LEFT: day label + divider + compact date + DayStrip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'var(--font-sora)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgb(245,158,11)',
            }}
          >
            Day {dayNumber}
          </span>
          <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              fontFamily: 'var(--font-sora)',
            }}
          >
            {compactDateLabel}
          </span>
          <div style={{ marginLeft: 36 }}>
            <DayStrip
              tripStartDate={startDate}
              tripEndDate={endDate}
              selectedDate={selectedDate ?? ''}
              onSelectDate={setSelectedDate}
              planItems={planItems}
            />
          </div>
        </div>

        {/* RIGHT: stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto', justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'var(--font-sora)',
            }}
          >
            {dayItems.length} {dayItems.length === 1 ? 'activity' : 'activities'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'var(--font-sora)',
            }}
          >
            {timeStr}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgb(245,158,11)',
              fontFamily: 'var(--font-sora)',
            }}
          >
            {dayItems.length === 0 ? '—' : formatCost(totalCost, currency)}
          </span>
        </div>
      </div>

      {/* ── 2. OVERVIEW BAR ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        <DayOverviewBar
          items={dayItems}
          hoveredActivityId={hoveredActivityId}
          onHoverActivity={(id) => {
            const t = performance.now().toFixed(1);
            console.log(`[STUTTER ${t}] TimelinePanel received onHoverActivity from overview → setHoveredActivityId(${id})`);
            setHoveredActivityId(id);
          }}
        />
      </div>

      {/* ── 3. MAIN CONTENT AREA ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* LEFT COLUMN: cards + connectors + intelligence */}
        <div
          style={{
            flex: 7,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '1px solid rgba(6,182,212,0.06)',
          }}
        >
          {/* Card scroll area */}
          <div
            className="no-scrollbar"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDate ?? 'empty'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
              >
                {dayItems.length === 0 ? (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.18)',
                        fontFamily: 'var(--font-sora)',
                      }}
                    >
                      No activities planned
                    </span>
                  </div>
                ) : (
                  dayItems.map((item, idx) => {
                    const travel = idx < dayItems.length - 1
                      ? estimateTravel(item, dayItems[idx + 1])
                      : null;
                    const TravelIcon = travel ? TRAVEL_ICONS[travel.mode] : null;
                    const activityId = item.id ? String(item.id) : `${item.day_number}-${item.sort_order}`;

                    return (
                      <div key={activityId}>
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.06, ease: 'easeOut' }}
                        >
                          <ActivityCard
                            item={item}
                            index={idx}
                            activityId={activityId}
                            isHighlighted={hoveredActivityId === activityId}
                            onHover={(id) => {
                              const t = performance.now().toFixed(1);
                              console.log(`[STUTTER ${t}] TimelinePanel received onHover from card → setHoveredActivityId(${id})`);
                              setHoveredActivityId(id);
                            }}
                          />
                        </motion.div>
                        {travel && TravelIcon && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: idx * 0.06 + 0.03 }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 0',
                                gap: 8,
                                pointerEvents: 'none',
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  height: 1,
                                  borderTop: '1px dashed rgba(6,182,212,0.15)',
                                }}
                              />
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '3px 10px',
                                  borderRadius: 9999,
                                  backgroundColor: 'rgba(6,182,212,0.04)',
                                  border: '1px solid rgba(6,182,212,0.1)',
                                }}
                              >
                                <TravelIcon size={11} color="rgba(6,182,212,0.6)" />
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: 'rgba(255,255,255,0.5)',
                                    fontFamily: 'sans-serif',
                                  }}
                                >
                                  {travel.duration}
                                </span>
                              </div>
                              <div
                                style={{
                                  flex: 1,
                                  height: 1,
                                  borderTop: '1px dashed rgba(6,182,212,0.15)',
                                }}
                              />
                            </div>
                          </motion.div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                          <button
                            onMouseEnter={() => setHoveredAddPos(item.sort_order)}
                            onMouseLeave={() => setHoveredAddPos(null)}
                            onClick={() => { setInsertAfterSortOrder(item.sort_order); setShowAddDialog(true); }}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              backgroundColor: hoveredAddPos === item.sort_order ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.06)',
                              border: hoveredAddPos === item.sort_order ? '1px dashed rgba(6,182,212,0.4)' : '1px dashed rgba(6,182,212,0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: hoveredAddPos === item.sort_order ? 'rgba(6,182,212,0.8)' : 'rgba(6,182,212,0.4)',
                              transition: 'background-color 200ms ease, border-color 200ms ease, color 200ms ease',
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Intelligence section */}
          <div
            style={{
              flexShrink: 0,
              padding: '10px 16px',
            }}
          >
            {/* Stats strip */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              {/* Total Walking */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Footprints size={12} color="rgba(6,182,212,0.4)" />
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    fontFamily: 'var(--font-sora)',
                  }}
                >
                  {walkLabel} walking
                </span>
              </div>

              <div style={{ width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.08)' }} />

              {/* Day Pace */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: i < paceDots ? paceDotColor : 'rgba(255,255,255,0.1)',
                      }}
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    fontFamily: 'var(--font-sora)',
                  }}
                >
                  {pace}
                </span>
              </div>

              <div style={{ width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.08)' }} />

              {/* Free Time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={12} color="rgba(6,182,212,0.4)" />
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    fontFamily: 'var(--font-sora)',
                  }}
                >
                  {freeLabel}
                </span>
              </div>
            </div>

            {/* AI Insight */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 12px',
                backgroundColor: 'rgba(245,158,11,0.04)',
                border: '1px solid rgba(245,158,11,0.1)',
                borderRadius: 8,
              }}
            >
              <Sparkles
                size={13}
                color="rgba(245,158,11,0.5)"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.4,
                  fontFamily: 'sans-serif',
                }}
              >
                {insightText}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: trip radar */}
        <div
          style={{
            flex: 4,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '8px 8px 12px',
            paddingTop: 8,
            overflow: 'hidden',
            overflowY: 'auto',
          }}
        >
          <TripRadar
            planItems={planItems}
            tripStartDate={startDate}
            tripEndDate={endDate}
          />
        </div>
      </div>

      {/* ── ADD ACTIVITY DIALOG ── */}
      {showAddDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddDialog(false); }}
        >
          <div
            style={{
              width: 440,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflowY: 'auto',
              backgroundColor: '#0c0f16',
              border: '1px solid rgba(6,182,212,0.15)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontFamily: 'var(--font-sora)' }}>
                Add Activity
              </span>
              <button
                onClick={() => setShowAddDialog(false)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Activity Type */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>Activity Type</label>
                <select
                  value={formData.activity_type}
                  onChange={(e) => setFormData(f => ({ ...f, activity_type: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="sightseeing">Sightseeing</option>
                  <option value="food">Food</option>
                  <option value="activity">Activity</option>
                  <option value="transport">Transport</option>
                  <option value="accommodation">Accommodation</option>
                </select>
              </div>

              {/* Start + End Time */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(f => ({ ...f, start_time: e.target.value }))}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(f => ({ ...f, end_time: e.target.value }))}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>Location</label>
                <input
                  type="text"
                  value={formData.location_name}
                  onChange={(e) => setFormData(f => ({ ...f, location_name: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Cost Estimate */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>Cost Estimate</label>
                <input
                  type="number"
                  placeholder="$0"
                  value={formData.cost_estimate}
                  onChange={(e) => setFormData(f => ({ ...f, cost_estimate: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Priority */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(f => ({ ...f, priority: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="must_do">Must Do</option>
                  <option value="nice_to_have">Nice to Have</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sora)', marginBottom: 4 }}>Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'sans-serif', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleAddActivity}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(245,158,11,0.85)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgb(245,158,11)'; }}
                style={{ width: '100%', padding: 12, borderRadius: 10, marginTop: 8, backgroundColor: 'rgb(245,158,11)', color: '#0a0a0a', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sora)', cursor: 'pointer', border: 'none', transition: 'all 150ms ease' }}
              >
                Add to Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
