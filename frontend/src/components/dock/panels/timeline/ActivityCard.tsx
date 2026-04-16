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
} from 'lucide-react';
import { type PlanItem } from '@/store/tripStore';

// ── Type config ────────────────────────────────────────────────────────────
const ACTIVITY_CONFIG: Record<string, { color: string; Icon: React.ElementType }> = {
  sightseeing:   { color: '#06b6d4', Icon: Landmark },
  food:          { color: '#fb923c', Icon: Utensils },
  activity:      { color: '#a78bfa', Icon: Music },
  transport:     { color: '#3b82f6', Icon: Plane },
  accommodation: { color: '#818cf8', Icon: Hotel },
};

const DEFAULT_COLOR = 'rgba(255,255,255,0.15)';

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

  useEffect(() => {
    if (isHighlighted && !expanded && !manualExpand.current) {
      setExpanded(true);
    }
    if (!isHighlighted && expanded && !manualExpand.current) {
      const timer = setTimeout(() => setExpanded(false), 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHighlighted]);

  const config = ACTIVITY_CONFIG[item.activity_type];
  const color  = config?.color ?? DEFAULT_COLOR;
  const Icon   = config?.Icon  ?? Landmark;

  const dimColor  = hexToRgba(color, 0.5);
  const iconColor = hexToRgba(color, 0.7);

  const showHighlight = isHovered || !!isHighlighted;

  const timeLabel =
    item.start_time && item.end_time
      ? `${item.start_time} – ${item.end_time}`
      : capitalize(item.time_slot);

  const locationLabel = item.address || item.location_name;
  const hasCoords     = item.latitude !== 0 || item.longitude !== 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      onClick={() => {
        const next = !expanded;
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
        borderLeft:           showHighlight ? `3px solid ${color}` : `3px solid ${dimColor}`,
        boxShadow:            !!isHighlighted
          ? `0 0 24px rgba(6,182,212,0.15), 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`
          : isHovered
          ? `0 0 20px rgba(6,182,212,0.15), 0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 1px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        borderRadius:         12,
        padding:              expanded ? '14px 16px' : '10px 16px',
        cursor:               'pointer',
        transition:           'all 200ms ease',
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover?.(activityId || null);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover?.(null);
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
          background:   `linear-gradient(90deg, ${hexToRgba(color, 0.06)} 0%, transparent 100%)`,
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

        {/* TOP ROW: icon + time range | priority + cost + duration */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left: icon + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={15} style={{ color: iconColor, flexShrink: 0 }} />
            <span
              style={{
                fontSize:   12,
                fontWeight: 500,
                color:      'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-geist), sans-serif',
              }}
            >
              {timeLabel}
            </span>
          </div>

          {/* Right: priority + cost + duration */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {item.priority && <PriorityBadge priority={item.priority} />}
            <span
              style={{
                fontSize:   13,
                fontWeight: 600,
                color:      'rgba(255,255,255,0.95)',
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
        </div>

        {/* TITLE ROW — with chevron indicator */}
        <div
          style={{
            marginTop:      6,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            8,
          }}
        >
          <span
            style={{
              fontSize:   15,
              fontWeight: 600,
              color:      'rgba(255,255,255,0.95)',
              fontFamily: 'var(--font-sora)',
              lineHeight: 1.3,
            }}
          >
            {item.title}
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

        {/* COLLAPSIBLE SECTION — description, location, notes */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: 6 }}>

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
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}
