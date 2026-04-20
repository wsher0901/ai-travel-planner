'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Landmark, Utensils, Music, Plane, Hotel, Calendar, ExternalLink, Sparkles, Tag } from 'lucide-react';
import { type PlanItem, type TripPlan } from '@/store/tripStore';
import { getActivityColor } from '@/lib/activityColors';
import { useUIStore } from '@/store/uiStore';

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  sightseeing: Landmark,
  food: Utensils,
  activity: Music,
  transport: Plane,
  accommodation: Hotel,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', JPY: '¥',
};

function currencySymbol(code?: string | null): string {
  if (!code) return '$';
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

function formatTime(t?: string | null): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr12 = h % 12 === 0 ? 12 : h % 12;
  return `${hr12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

interface Props {
  dayItems: PlanItem[];
  selectedDate: string | null;
  tripPlan: TripPlan | null;
}

const PRIORITY_STYLES = {
  must_do: {
    bg: 'rgba(245,158,11,0.12)',
    color: 'rgb(245,158,11)',
    border: 'rgba(245,158,11,0.3)',
    label: 'Must',
  },
  nice_to_have: {
    bg: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.45)',
    border: 'rgba(255,255,255,0.08)',
    label: 'Nice',
  },
  flexible: {
    bg: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.3)',
    border: 'rgba(255,255,255,0.08)',
    label: 'Flex',
  },
};

export default function ActivityList({ dayItems, tripPlan }: Props) {
  const hoveredActivityId = useUIStore((s) => s.hoveredActivityId);
  const expandedActivityId = useUIStore((s) => s.expandedActivityId);
  const setHoveredActivityId = useUIStore((s) => s.setHoveredActivityId);
  const setExpandedActivityId = useUIStore((s) => s.setExpandedActivityId);

  const sorted = useMemo(() => {
    return [...dayItems].sort((a, b) => {
      const aT = a.start_time ? timeToMin(a.start_time) : 99999;
      const bT = b.start_time ? timeToMin(b.start_time) : 99999;
      return aT - bT;
    });
  }, [dayItems]);

  if (sorted.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontFamily: 'var(--font-sora)',
        fontSize: 13,
        color: 'rgba(255,255,255,0.3)',
      }}>
        No activities planned for this day
      </div>
    );
  }

  const currency = currencySymbol(tripPlan?.currency);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((item, idx) => {
        const color = getActivityColor(item.activity_type);
        const Icon = TYPE_ICONS[item.activity_type ?? 'activity'] ?? Music;
        const priority = (item.priority ?? 'flexible') as keyof typeof PRIORITY_STYLES;
        const prioStyle = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.flexible;
        const location = item.location_name ?? item.address;
        const rowId = item.id ? String(item.id) : null;
        const isExpanded = rowId !== null && (rowId === hoveredActivityId || rowId === expandedActivityId);

        return (
          <motion.div
            key={item.id ? String(item.id) : `row-${idx}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => { if (rowId) setExpandedActivityId(rowId === expandedActivityId ? null : rowId); }}
            onMouseEnter={() => { if (rowId) setHoveredActivityId(rowId); }}
            onMouseLeave={() => setHoveredActivityId(null)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderLeft: `3px solid ${color}`,
              borderRadius: 10,
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'background-color 150ms ease, border-color 150ms ease',
            }}
          >
            {/* ==== Compact row ==== */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
            }}>
              {/* Time block */}
              <div style={{
                width: 64,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: 'rgba(255,255,255,0.9)',
                  fontFamily: 'var(--font-sora)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatTime(item.start_time)}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 500,
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: 'var(--font-sora)',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 1,
                }}>
                  {item.end_time ? formatTime(item.end_time) : (item.duration_minutes ? `${item.duration_minutes} min` : '')}
                </span>
              </div>

              {/* Middle */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: 'rgba(255,255,255,0.9)',
                  fontFamily: 'var(--font-sora)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.title}
                </div>
                {location && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: 'var(--font-sora)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    <MapPin size={11} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{location}</span>
                  </div>
                )}
              </div>

              {/* Right */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
              }}>
                <Icon size={13} color={color} />
                <span style={{
                  fontSize: 9, fontWeight: 500,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: prioStyle.bg,
                  color: prioStyle.color,
                  border: `1px solid ${prioStyle.border}`,
                  fontFamily: 'var(--font-sora)',
                  whiteSpace: 'nowrap',
                }}>
                  {prioStyle.label}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: 'var(--font-sora)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 44,
                  textAlign: 'right',
                }}>
                  {currency}{item.cost_estimate ?? 0}
                </span>
              </div>
            </div>

            {/* ==== Expanded section ==== */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    padding: '12px 16px 14px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: 'rgba(255,255,255,0.015)',
                  }}>
                    {(item.location_name || item.address) && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <MapPin size={13} color="rgba(255,255,255,0.4)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-sora)' }}>
                          {item.location_name && <div style={{ fontWeight: 600 }}>{item.location_name}</div>}
                          {item.address && <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{item.address}</div>}
                        </div>
                      </div>
                    )}

                    {(item as PlanItem & { reasoning?: string }).reasoning && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <Sparkles size={13} color="rgba(245,158,11,0.7)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-sora)', lineHeight: 1.5 }}>
                          {(item as PlanItem & { reasoning?: string }).reasoning}
                        </div>
                      </div>
                    )}

                    {item.tags && item.tags.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Tag size={12} color="rgba(255,255,255,0.4)" />
                        {item.tags.map((t, i) => (
                          <span key={i} style={{
                            fontSize: 10, fontWeight: 500,
                            padding: '2px 7px', borderRadius: 4,
                            background: 'rgba(6,182,212,0.08)',
                            color: 'rgba(6,182,212,0.9)',
                            border: '1px solid rgba(6,182,212,0.2)',
                            fontFamily: 'var(--font-sora)',
                          }}>{t}</span>
                        ))}
                      </div>
                    )}

                    {item.is_booked !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={13} color={item.is_booked ? 'rgb(34,197,94)' : 'rgba(255,255,255,0.4)'} />
                        <span style={{
                          fontSize: 12, fontFamily: 'var(--font-sora)',
                          color: item.is_booked ? 'rgb(34,197,94)' : 'rgba(255,255,255,0.55)',
                        }}>
                          {item.is_booked ? 'Booked' : 'Not booked yet'}
                        </span>
                        {item.booking_url && (
                          <a href={item.booking_url} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 11, color: 'rgb(6,182,212)', display: 'inline-flex', alignItems: 'center', gap: 3,
                            textDecoration: 'none', marginLeft: 4,
                          }} onClick={(e) => e.stopPropagation()}>
                            Open <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
