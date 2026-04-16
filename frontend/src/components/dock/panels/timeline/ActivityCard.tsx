'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark,
  Utensils,
  Music,
  Plane,
  Hotel,
  MapPin,
  Lightbulb,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { type PlanItem } from '@/store/tripStore';
import { getActivityColor } from '@/lib/activityColors';

// ── Type config ────────────────────────────────────────────────────────────
const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  sightseeing:   Landmark,
  food:          Utensils,
  activity:      Music,
  transport:     Plane,
  accommodation: Hotel,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', JPY: '¥',
};

function formatCost(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function calcDuration(item: PlanItem): string | null {
  let minutes: number | null = null;
  if (item.duration_minutes && item.duration_minutes > 0) {
    minutes = item.duration_minutes;
  } else if (item.start_time && item.end_time) {
    const [sh, sm] = item.start_time.split(':').map(Number);
    const [eh, em] = item.end_time.split(':').map(Number);
    if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
      minutes = (eh * 60 + em) - (sh * 60 + sm);
    }
  }
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatCoords(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`;
}

// ── Priority badge ─────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const styles: React.CSSProperties =
    priority === 'must_do'
      ? {
          backgroundColor: 'rgba(245,158,11,0.15)',
          color: 'rgb(245,158,11)',
          border: '1px solid rgba(245,158,11,0.3)',
        }
      : priority === 'nice_to_have'
      ? {
          backgroundColor: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
        }
      : {
          backgroundColor: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
        };

  const label =
    priority === 'must_do'      ? 'Must Do'      :
    priority === 'nice_to_have' ? 'Nice to Have' : 'Flexible';

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 6,
        fontFamily: 'var(--font-sora)',
        ...styles,
      }}
    >
      {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
interface ActivityCardProps {
  item: PlanItem;
  index: number;
  activityId?: string;
  isHighlighted?: boolean;
  onHover?: (id: string | null) => void;
}

export default function ActivityCard({ item, index, activityId, isHighlighted, onHover }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const manualExpand = useRef(false);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoCollapseRef = useRef<number>(0);

  useEffect(() => {
    const t = performance.now().toFixed(1);
    const now = performance.now();
    const sinceCollapse = now - lastAutoCollapseRef.current;
    console.log(`[STUTTER ${t}] Card "${item.title}" useEffect: isHighlighted=${isHighlighted}, expanded=${expanded}, manualExpand=${manualExpand.current}, sinceCollapse=${sinceCollapse.toFixed(0)}ms`);

    if (isHighlighted && !expanded && !manualExpand.current) {
      if (sinceCollapse < 150) {
        console.log(`[STUTTER ${t}] Card "${item.title}" → expand BLOCKED by cooldown (${sinceCollapse.toFixed(0)}ms)`);
        return;
      }
      console.log(`[STUTTER ${t}] Card "${item.title}" → setExpanded(true) via useEffect`);
      setExpanded(true);
    }
    if (!isHighlighted && expanded && !manualExpand.current) {
      console.log(`[STUTTER ${t}] Card "${item.title}" → setExpanded(false) via useEffect`);
      lastAutoCollapseRef.current = now;
      setExpanded(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHighlighted]);

  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  const typeColor = getActivityColor(item.activity_type);
  const Icon      = ACTIVITY_ICONS[item.activity_type] ?? Landmark;

  const dimColor  = hexToRgba(typeColor, 0.5);
  const iconColor = hexToRgba(typeColor, 0.7);

  const showHighlight = isHovered || !!isHighlighted;

  const timeLabel =
    item.start_time && item.end_time
      ? `${item.start_time} – ${item.end_time}`
      : capitalize(item.time_slot);

  const locationLabel = item.address || item.location_name;
  const hasCoords     = item.latitude !== 0 || item.longitude !== 0;
  const locationText  = item.location_name || item.address || null;
  const durationText  = calcDuration(item);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      onClick={() => {
        const t = performance.now().toFixed(1);
        const next = !expanded;
        console.log(`[STUTTER ${t}] Card "${item.title}" CLICK → setExpanded(${next}), manualExpand=${next}`);
        setExpanded(next);
        manualExpand.current = next;
      }}
      style={{
        position:             'relative',
        overflow:             'hidden',
        backgroundColor:      showHighlight ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.03)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:               showHighlight ? '1px solid rgba(6,182,212,0.25)' : '1px solid rgba(6,182,212,0.08)',
        borderLeft:           showHighlight ? `3px solid ${typeColor}` : `3px solid ${dimColor}`,
        boxShadow:            !!isHighlighted
          ? `0 0 24px rgba(6,182,212,0.15), 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`
          : isHovered
          ? `0 0 20px rgba(6,182,212,0.15), 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        borderRadius:         12,
        padding:              '12px 16px',
        minHeight:            '72px',
        cursor:               'pointer',
        transition:           'background-color 200ms ease, border-color 200ms ease, border-left-color 200ms ease, box-shadow 200ms ease',
      }}
      onMouseEnter={() => {
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current);
          leaveTimeoutRef.current = null;
        }
        const t = performance.now().toFixed(1);
        console.log(`[STUTTER ${t}] Card "${item.title}" MOUSE_ENTER → setIsHovered(true), onHover(${activityId})`);
        setIsHovered(true);
        onHover?.(activityId || null);
      }}
      onMouseLeave={() => {
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current);
        }
        leaveTimeoutRef.current = setTimeout(() => {
          const t = performance.now().toFixed(1);
          console.log(`[STUTTER ${t}] Card "${item.title}" MOUSE_LEAVE (debounced) → setIsHovered(false), onHover(null)`);
          setIsHovered(false);
          onHover?.(null);
          leaveTimeoutRef.current = null;
        }, 30);
      }}
    >
      {/* Ambient glow — soft light bleed from the left border */}
      <div
        style={{
          position:     'absolute',
          left:         0,
          top:          0,
          bottom:       0,
          width:        40,
          background:   `linear-gradient(90deg, ${hexToRgba(typeColor, 0.06)} 0%, transparent 100%)`,
          borderRadius: '12px 0 0 12px',
          pointerEvents:'none',
          zIndex:       0,
        }}
      />

      {/* Top edge light line — Jarvis panel shimmer */}
      <div
        style={{
          position:     'absolute',
          top:          0,
          left:         20,
          right:        20,
          height:       1,
          background:   'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.15) 50%, transparent 100%)',
          pointerEvents:'none',
          zIndex:       2,
        }}
      />

      {/* Card content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Two-row layout: main scan row + meta row (collapsed only) */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>

        {/* MAIN ROW: 3-zone layout — left cluster | centered title | right time */}
        <div
          style={{
            position:   'relative',
            display:    'flex',
            alignItems: 'center',
            width:      '100%',
            minHeight:  '24px',
          }}
        >

          {/* LEFT CLUSTER — icon, priority, cost, duration badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, zIndex: 1 }}>
            <Icon size={15} style={{ color: iconColor, flexShrink: 0 }} />
            {item.priority && <PriorityBadge priority={item.priority} />}
            <span
              style={{
                fontSize:   13,
                fontWeight: 600,
                color:      'rgba(255,255,255,0.9)',
                fontFamily: 'var(--font-sora)',
              }}
            >
              {formatCost(item.cost_estimate, item.currency)}
            </span>
            <span
              style={{
                fontSize:        10,
                color:           'rgba(255,255,255,0.45)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                padding:         '2px 6px',
                borderRadius:    4,
              }}
            >
              {formatDuration(item.duration_minutes)}
            </span>
          </div>

          {/* CENTER — collapsed only: absolute center, fades out on expand */}
          <AnimatePresence mode="wait">
            {!expanded && (
              <motion.div
                key="collapsed-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                style={{
                  position:      'absolute',
                  left:          '50%',
                  top:           '50%',
                  transform:     'translate(-50%, -50%)',
                  maxWidth:      '45%',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                  whiteSpace:    'nowrap',
                  textAlign:     'center',
                  pointerEvents: 'none',
                  zIndex:        0,
                }}
              >
                <span
                  style={{
                    fontSize:   15,
                    fontWeight: 600,
                    color:      'rgba(255,255,255,0.95)',
                    fontFamily: 'var(--font-sora)',
                    lineHeight: 1.3,
                    display:    'block',
                  }}
                >
                  {item.title}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* RIGHT — time + chevron */}
          <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}>
            <span
              style={{
                fontSize:          14,
                fontWeight:        600,
                color:             'rgba(255,255,255,0.85)',
                fontFamily:        'var(--font-sora)',
                fontVariantNumeric:'tabular-nums',
              }}
            >
              {timeLabel}
            </span>
            <ChevronDown
              size={14}
              style={{
                color:      'rgba(255,255,255,0.2)',
                flexShrink: 0,
                transform:  expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms ease',
              }}
            />
          </div>
        </div>

          {/* META ROW — location + duration (collapsed only) */}
          {!expanded && (locationText || durationText) && (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        0,
                fontSize:   '12px',
                fontFamily: 'var(--font-geist-sans)',
                fontWeight: 400,
                color:      'rgba(255,255,255,0.5)',
                minWidth:   0,
              }}
            >
              {locationText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: '0 1 auto' }}>
                  <MapPin size={12} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {locationText}
                  </span>
                </div>
              )}
              {locationText && durationText && (
                <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>•</span>
              )}
              {durationText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <Clock size={12} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{durationText}</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* COLLAPSIBLE SECTION — description, location, notes */}
        <div
          style={{
            overflow:     'hidden',
            maxHeight:    expanded ? '1000px' : '0px',
            opacity:      expanded ? 1 : 0,
            transition:   'max-height 120ms ease-out, opacity 100ms ease-out',
            pointerEvents: expanded ? 'auto' : 'none',
          }}
        >
          <div style={{ marginTop: 6 }}>

            {/* EXPANDED TITLE — left-aligned, fades in on expand */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  key="expanded-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut', delay: 0.06 }}
                  style={{
                    textAlign:    'left',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize:   15,
                      fontWeight: 600,
                      color:      'rgba(255,255,255,0.95)',
                      fontFamily: 'var(--font-sora)',
                      lineHeight: 1.3,
                      display:    'block',
                    }}
                  >
                    {item.title}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* DESCRIPTION — clamped to 2 lines */}
            <p
              style={{
                marginTop:           0,
                marginBottom:        0,
                fontSize:            13,
                fontWeight:          400,
                color:               'rgba(255,255,255,0.6)',
                lineHeight:          1.5,
                fontFamily:          'sans-serif',
                display:             '-webkit-box',
                WebkitLineClamp:     2,
                WebkitBoxOrient:     'vertical',
                overflow:            'hidden',
                textOverflow:        'ellipsis',
              }}
            >
              {item.description}
            </p>

            {/* DETAILS ROW: location + coordinates */}
            <div
              style={{
                marginTop:  8,
                display:    'flex',
                alignItems: 'center',
                gap:        12,
              }}
            >
              {locationLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} style={{ color: 'rgba(6,182,212,0.4)', flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize:     11,
                      color:        'rgba(255,255,255,0.5)',
                      fontFamily:   'sans-serif',
                      maxWidth:     250,
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    {locationLabel}
                  </span>
                </div>
              )}
              {hasCoords && (
                <span
                  style={{
                    fontSize:      9,
                    color:         'rgba(6,182,212,0.4)',
                    fontFamily:    'monospace',
                    letterSpacing: '0.03em',
                  }}
                >
                  {formatCoords(item.latitude, item.longitude)}
                </span>
              )}
            </div>

            {/* NOTES ROW — only if notes is non-empty */}
            {item.notes && item.notes.trim() && (
              <div
                style={{
                  marginTop:  6,
                  display:    'flex',
                  alignItems: 'flex-start',
                  gap:        4,
                }}
              >
                <Lightbulb
                  size={11}
                  style={{ color: 'rgba(245,158,11,0.4)', flexShrink: 0, marginTop: 2 }}
                />
                <span
                  style={{
                    fontSize:   11,
                    fontStyle:  'italic',
                    color:      'rgba(245,158,11,0.6)',
                    lineHeight: 1.4,
                  }}
                >
                  {item.notes}
                </span>
              </div>
            )}

          </div>
        </div>

      </div>
    </motion.div>
  );
}
