'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, type PanInfo, type MotionValue } from 'framer-motion';
import {
  X, Check, MapPin, Info, AlertTriangle, Sparkles, Loader2,
  Moon, Sun, Sunrise, Sunset,
  Plane, BedDouble, UtensilsCrossed, Landmark, Ticket,
  Mountain, TreePine, ShoppingBag, GlassWater, Flower2,
  type LucideIcon,
} from 'lucide-react';
import { useTripStore, type PlanItem } from '@/store/tripStore';
import { getActivityColor } from '@/lib/activityColors';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  prefillStartTime?: string;
  prefillDurationMinutes?: number;
}

type ActivityTypeEnum =
  | 'sightseeing' | 'food' | 'entertainment' | 'outdoor' | 'nature'
  | 'shopping' | 'nightlife' | 'wellness' | 'transport' | 'accommodation';

const TYPE_ICONS: Record<ActivityTypeEnum, LucideIcon> = {
  sightseeing:   Landmark,
  food:          UtensilsCrossed,
  entertainment: Ticket,
  outdoor:       Mountain,
  nature:        TreePine,
  shopping:      ShoppingBag,
  nightlife:     GlassWater,
  wellness:      Flower2,
  transport:     Plane,
  accommodation: BedDouble,
};

const TYPE_META: { value: ActivityTypeEnum; label: string; desc: string }[] = [
  { value: 'sightseeing',   label: 'Sights',    desc: 'Landmarks & tours' },
  { value: 'food',          label: 'Food',       desc: 'Meals & tastings' },
  { value: 'entertainment', label: 'Shows',      desc: 'Entertainment & events' },
  { value: 'outdoor',       label: 'Outdoor',    desc: 'Active adventures' },
  { value: 'nature',        label: 'Nature',     desc: 'Parks & scenery' },
  { value: 'shopping',      label: 'Shopping',   desc: 'Markets & boutiques' },
  { value: 'nightlife',     label: 'Nightlife',  desc: 'Bars & late-night' },
  { value: 'wellness',      label: 'Wellness',   desc: 'Spa & relaxation' },
  { value: 'transport',     label: 'Transport',  desc: 'Flights & transit' },
  { value: 'accommodation', label: 'Stay',       desc: 'Lodging & hotels' },
];

const PRIORITIES = ['must_do', 'nice_to_have', 'flexible'] as const;
type PriorityEnum = typeof PRIORITIES[number];

const PRIORITY_LABELS: Record<PriorityEnum, string> = {
  must_do: 'Must',
  nice_to_have: 'Nice',
  flexible: 'Flex',
};

const PRIORITY_COLORS: Record<PriorityEnum, string> = {
  must_do: '#F59E0B',
  nice_to_have: '#06B6D4',
  flexible: '#A78BFA',
};

type DurationPreset = '30' | '60' | '120' | '180';

const DURATION_PRESET_VALUES: Record<DurationPreset, number> = {
  '30': 30, '60': 60, '120': 120, '180': 180,
};

const DURATION_PRESET_LABELS: Record<DurationPreset, string> = {
  '30': '30m', '60': '1h', '120': '2h', '180': '3h',
};

const EASE = [0.22, 1, 0.36, 1] as const;

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(min: number): string {
  const safe = Math.max(0, Math.min(1440, min));
  const h = Math.floor(safe / 60) % 24;
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHour12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr12 = h % 12 === 0 ? 12 : h % 12;
  return `${hr12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function isValidPreset(minutes: number): minutes is 30 | 60 | 120 | 180 {
  return minutes === 30 || minutes === 60 || minutes === 120 || minutes === 180;
}

function DialIcon({
  meta, i, isActive, dialRotation,
}: {
  meta: (typeof TYPE_META)[0];
  i: number;
  isActive: boolean;
  dialRotation: MotionValue<number>;
}) {
  const sliceAngle = i * 36;
  const counterAngle = useTransform(dialRotation, (r) => -sliceAngle - r);
  const c = getActivityColor(meta.value);
  const Icon = TYPE_ICONS[meta.value];
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: 0, height: 0,
      transform: `rotate(${sliceAngle}deg) translateY(-84px)`,
      pointerEvents: 'none',
    }}>
      <motion.div
        aria-label={meta.label}
        style={{
          x: '-50%', y: '-50%', rotate: counterAngle,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}
      >
        <Icon
          size={18}
          strokeWidth={2}
          color={isActive ? c : `${c}88`}
          style={{
            filter: isActive ? `drop-shadow(0 0 6px ${c}aa)` : 'none',
            transition: 'filter 220ms ease, color 220ms ease',
          }}
        />
        <span style={{
          fontSize: 7,
          fontFamily: 'var(--font-geist-mono)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: isActive ? c : `${c}55`,
          whiteSpace: 'nowrap',
          lineHeight: 1,
          transition: 'color 220ms ease',
        }}>
          {meta.label}
        </span>
      </motion.div>
    </div>
  );
}

export default function AddActivityDialog({
  open, onClose, selectedDate, prefillStartTime, prefillDurationMinutes = 60,
}: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ActivityTypeEnum>('sightseeing');
  const [priority, setPriority] = useState<PriorityEnum>('nice_to_have');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [cost, setCost] = useState(0);
  const [locationName, setLocationName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [durationPreset, setDurationPreset] = useState<DurationPreset>('60');
  const [hoveredPriority, setHoveredPriority] = useState<PriorityEnum | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [btnHovered, setBtnHovered] = useState(false);

  const [tooltipRect, setTooltipRect] = useState<{ left: number; top: number } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addPlanItem = useTripStore((s) => s.addPlanItem);
  const planItems = useTripStore((s) => s.planItems);

  const isMountedRef = useRef(true);
  const pendingItemRef = useRef<PlanItem | null>(null);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleId = 'add-activity-title';

  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  const [scrubberFocused, setScrubberFocused] = useState(false);

  const dialRef = useRef<HTMLDivElement>(null);
  const rotation = useMotionValue(0);
  const [panning, setPanning] = useState(false);
  const [dialFocused, setDialFocused] = useState(false);
  const panStartAngleRef = useRef<number | null>(null);
  const panStartRotationRef = useRef(0);
  const panMovedRef = useRef(false);
  const dragConsumedRef = useRef(false);

  const dragStartTimeRef = useRef<string>('09:00');
  const [editingField, setEditingField] = useState<'hour' | 'minute' | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRect, setPickerRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const timeReadoutRef = useRef<HTMLDivElement>(null);
  const clockBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setType('sightseeing');
    setPriority('nice_to_have');
    setStartTime(prefillStartTime ?? '09:00');
    setDuration(prefillDurationMinutes);
    setCost(0);
    setLocationName('');
    setSubmitSuccess(false);
    setSubmitError(null);
    setHoveredPriority(null);
    setBtnHovered(false);
    setDragging(false);
    setScrubberFocused(false);
    setPanning(false);
    setDialFocused(false);
    panStartAngleRef.current = null;
    panMovedRef.current = false;

    if (isValidPreset(prefillDurationMinutes)) {
      setDurationPreset(String(prefillDurationMinutes) as DurationPreset);
    } else {
      setDurationPreset('60');
    }

    const raf = requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, prefillStartTime, prefillDurationMinutes]);

  const endTime = useMemo(() => addMinutes(startTime, duration), [startTime, duration]);

  const existingForDay = useMemo(() => {
    return planItems.filter((i) =>
      i.date?.slice(0, 10) === selectedDate && i.start_time
    );
  }, [planItems, selectedDate]);

  const conflict = useMemo(() => {
    if (!startTime || !duration) return null;
    const startMin = timeToMin(startTime);
    const endMin = startMin + duration;
    for (const it of existingForDay) {
      const iStart = timeToMin(it.start_time!);
      const iDur = it.end_time
        ? timeToMin(it.end_time) - iStart
        : it.duration_minutes ?? 60;
      const iEnd = iStart + iDur;
      if (startMin < iEnd && endMin > iStart) {
        return { title: it.title ?? 'existing activity' };
      }
    }
    return null;
  }, [existingForDay, startTime, duration]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await addPlanItem({
        title: title.trim(),
        activity_type: type,
        priority,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        date: selectedDate,
        cost_estimate: cost,
        location_name: locationName || null,
      });
      if (result) {
        pendingItemRef.current = result;
        setSubmitSuccess(true);
        await new Promise<void>((r) => {
          const t = setTimeout(() => { if (isMountedRef.current) r(); else r(); }, 400);
          // cleanup: if component unmounts before timeout, timer still fires but state updates are no-ops
          void t;
        });
        if (isMountedRef.current) {
          setSubmitSuccess(false);
          onClose();
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to save activity');
      }
    } finally {
      setSubmitting(false);
    }
  }, [title, submitting, addPlanItem, type, priority, startTime, endTime, duration, selectedDate, cost, locationName, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerOpen) { e.preventDefault(); setPickerOpen(false); setPickerRect(null); return; }
        if (editingField) { e.preventDefault(); setEditingField(null); setEditBuffer(''); return; }
        e.preventDefault();
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!submitting && title.trim()) {
          e.preventDefault();
          void handleSubmit();
        }
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, submitting, title, handleSubmit, onClose, pickerOpen, editingField]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      if (trackRef.current) setTrackWidth(trackRef.current.offsetWidth);
    };
    measure();
    const el = trackRef.current;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (dragging || trackWidth === 0) return;
    const pct = timeToMin(startTime) / 1440;
    x.set(pct * trackWidth);
  }, [startTime, trackWidth, dragging, x]);

  useEffect(() => {
    // Use functional updater to read current startTime without adding it to deps
    // (avoids an update loop: duration change → startTime clamp → startTime change → re-run)
    setStartTime((cur) => {
      const startMin = timeToMin(cur);
      if (startMin + duration > 1440) {
        return minToTime(Math.max(0, 1440 - duration));
      }
      return cur;
    });
  }, [duration]);

  const blockWidthPx = trackWidth > 0 ? (duration / 1440) * trackWidth : 0;
  const maxX = Math.max(0, trackWidth - blockWidthPx);

  const updateH12 = useCallback((delta: number) => {
    setStartTime((cur) => {
      const [h24, m] = cur.split(':').map(Number);
      const isPm = h24 >= 12;
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      const newH12 = ((h12 - 1 + delta + 12) % 12) + 1;
      const newH24 = isPm ? (newH12 === 12 ? 12 : newH12 + 12) : (newH12 === 12 ? 0 : newH12);
      return `${String(newH24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    });
  }, []);

  const updateMinute = useCallback((delta: number) => {
    setStartTime((cur) => {
      const [h24, m] = cur.split(':').map(Number);
      const newM = ((m + delta) % 60 + 60) % 60;
      return `${String(h24).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    });
  }, []);

  const toggleAmPm = useCallback(() => {
    setStartTime((cur) => {
      const [h24, m] = cur.split(':').map(Number);
      const newH24 = h24 >= 12 ? h24 - 12 : h24 + 12;
      return `${String(newH24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    });
  }, []);

  const openPicker = useCallback(() => {
    if (!timeReadoutRef.current) return;
    const rect = timeReadoutRef.current.getBoundingClientRect();
    setPickerRect({ left: rect.left, top: rect.bottom + 8, width: rect.width });
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerRect(null);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingField) return;
    const num = parseInt(editBuffer, 10);
    if (!isNaN(num)) {
      const [h24, m] = startTime.split(':').map(Number);
      if (editingField === 'hour') {
        let newH24: number;
        if (num === 0 || num === 24) {
          newH24 = 0;
        } else if (num >= 13 && num <= 23) {
          newH24 = num;
        } else {
          const isPm = h24 >= 12;
          const clamped = Math.min(12, Math.max(1, num));
          newH24 = isPm ? (clamped === 12 ? 12 : clamped + 12) : (clamped === 12 ? 0 : clamped);
        }
        setStartTime(`${String(newH24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      } else {
        const clamped = Math.min(59, Math.max(0, num));
        setStartTime(`${String(h24).padStart(2, '0')}:${String(clamped).padStart(2, '0')}`);
      }
    }
    setEditingField(null);
    setEditBuffer('');
  }, [editingField, editBuffer, startTime]);

  const handleDrag = useCallback(() => {
    if (trackWidth === 0) return;
    const pct = Math.max(0, Math.min(1, x.get() / trackWidth));
    const snappedMin = Math.round((pct * 1440) / 5) * 5;
    const clamped = Math.max(0, Math.min(1440 - duration, snappedMin));
    dragStartTimeRef.current = minToTime(clamped);
    setStartTime(minToTime(clamped));
  }, [trackWidth, duration, x]);

  const handleScrubberKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const stepMin = e.shiftKey ? 30 : 5;
    const startMin = timeToMin(startTime);
    let newStartMin: number | null = null;
    if (e.key === 'ArrowLeft') newStartMin = Math.max(0, startMin - stepMin);
    else if (e.key === 'ArrowRight') newStartMin = Math.min(1440 - duration, startMin + stepMin);
    if (newStartMin != null) {
      e.preventDefault();
      setStartTime(minToTime(newStartMin));
    }
  };

  const getDialAngle = useCallback((px: number, py: number) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = px - cx;
    const dy = py - cy;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  }, []);

  const selectedIndex = useMemo(
    () => Math.max(0, TYPE_META.findIndex((t) => t.value === type)),
    [type]
  );

  useEffect(() => {
    if (!open) return;
    if (panning) return; // don't fight active drag
    const target = -(selectedIndex * 36);
    const current = rotation.get();
    const k = Math.round((current - target) / 360);
    const nearest = target + k * 360;
    const controls = animate(rotation, nearest, {
      type: 'spring', stiffness: 320, damping: 26, mass: 0.8,
    });
    return () => controls.stop();
  }, [selectedIndex, rotation, open, panning]);

  // typeRef lets the wheel handler read current type without being in its dep array,
  // preventing the handler from being re-registered on every type change.
  const typeRef = useRef(type);
  useEffect(() => { typeRef.current = type; }, [type]);

  useEffect(() => {
    if (!open) return;
    const el = dialRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const currentIndex = TYPE_META.findIndex((t) => t.value === typeRef.current);
      if (currentIndex === -1) return;
      const step = e.deltaY > 0 ? 1 : -1;
      const nextIndex = (currentIndex + step + TYPE_META.length) % TYPE_META.length;
      setType(TYPE_META[nextIndex].value);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [open]);


  const handleDialPanStart = (_e: unknown, info: PanInfo) => {
    panStartAngleRef.current = getDialAngle(info.point.x, info.point.y);
    panStartRotationRef.current = rotation.get();
    panMovedRef.current = false;
    setPanning(true);
  };

  const handleDialPan = (_e: unknown, info: PanInfo) => {
    if (panStartAngleRef.current === null) return;
    const currentAngle = getDialAngle(info.point.x, info.point.y);
    let delta = currentAngle - panStartAngleRef.current;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    if (Math.abs(delta) > 3) {
      panMovedRef.current = true;
      dragConsumedRef.current = true;
    }
    rotation.set(panStartRotationRef.current + delta);
  };

  const handleDialPanEnd = () => {
    if (panStartAngleRef.current === null) {
      setPanning(false);
      return;
    }
    panStartAngleRef.current = null;
    panMovedRef.current = false;

    const r = rotation.get();
    const normalized = ((-r % 360) + 360) % 360;
    const index = Math.round(normalized / 36) % 10;
    const newType = TYPE_META[index].value;

    setPanning(false);

    if (newType !== type) {
      setType(newType); // useEffect on selectedIndex animates rotation
    } else {
      // Type unchanged — animate rotation manually to exact slice angle.
      const target = -(index * 36);
      const k = Math.round((r - target) / 360);
      animate(rotation, target + k * 360, {
        type: 'spring', stiffness: 320, damping: 26, mass: 0.8,
      });
    }
  };

  const handleDialClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragConsumedRef.current) {
      dragConsumedRef.current = false;
      return;
    }
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 28 || dist > 122) return;
    let viewAngle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (viewAngle < 0) viewAngle += 360;
    const r = ((rotation.get() % 360) + 360) % 360;
    let adjusted = (viewAngle - r) % 360;
    while (adjusted < 0) adjusted += 360;
    const sliceIndex = Math.round(adjusted / 36) % 10;
    setType(TYPE_META[sliceIndex].value);
  };

  const handleDialKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TYPE_META.findIndex((t) => t.value === type);
    if (currentIndex === -1) return;
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % 10;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex + 9) % 10;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = 9;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      setType(TYPE_META[nextIndex].value);
    }
  };

  const selectedTypeColor = getActivityColor(type);

  const dialogBoxShadow = [
    '0 24px 80px rgba(0,0,0,0.75)',
    '0 0 0 1px rgba(6,182,212,0.05)',
    `0 0 48px ${selectedTypeColor}26`,
  ].join(', ');

  const sectionLabelRow = (num: number, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'relative', zIndex: 1 }}>
      <div
        className="aa-section-badge"
        style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(6,182,212,0.08)',
          border: '1px solid rgba(6,182,212,0.35)',
          color: 'rgb(6,182,212)',
          fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sora)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
        color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
        fontFamily: 'var(--font-sora)',
      }}>{label}</span>
    </div>
  );

  const renderHeader = () => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0, ease: EASE }}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          id={titleId}
          style={{
            fontSize: 16,
            fontWeight: 600,
            background: 'linear-gradient(135deg, rgb(255,255,255) 0%, rgba(255,255,255,0.72) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            fontFamily: 'var(--font-sora)',
            lineHeight: 1.2,
            letterSpacing: '-0.005em',
          }}
        >
          Add activity
        </div>
        <div style={{
          marginTop: 3,
          fontSize: 11,
          color: 'rgba(6,182,212,0.9)',
          letterSpacing: '0.14em',
          fontFamily: 'var(--font-sora)',
          fontWeight: 500,
          textTransform: 'uppercase',
        }}>
          {formatDayLabel(selectedDate)}
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Close dialog"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          marginRight: -4,
          marginTop: -2,
          borderRadius: 6,
          transition: 'all 160ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <X size={16} />
      </button>
    </motion.div>
  );

  const inputBase: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.03)',
    border: '1.5px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    fontWeight: 500,
    fontFamily: 'var(--font-sora)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms cubic-bezier(0.22, 1, 0.36, 1)',
  };

  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(6,182,212,0.6)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(6,182,212,0.1), inset 0 0 10px rgba(6,182,212,0.06)';
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleTooltipEnter = (e: React.FocusEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setTooltipRect({ left: rect.left + rect.width / 2, top: rect.top });
    }, 300);
  };

  const handleTooltipLeave = () => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltipRect(null);
  };

  const renderTypeDial = () => {
    const selectedMeta = TYPE_META[selectedIndex];
    const selectedColor = getActivityColor(selectedMeta.value);
    const SelectedIcon = TYPE_ICONS[selectedMeta.value];

    const wedgeR = 98;
    const half = (18 * Math.PI) / 180;
    const wx1 = -wedgeR * Math.sin(half);
    const wy1 = -wedgeR * Math.cos(half);
    const wx2 = wedgeR * Math.sin(half);
    const wy2 = -wedgeR * Math.cos(half);
    const wedgePath = `M 0 0 L ${wx1.toFixed(2)} ${wy1.toFixed(2)} A ${wedgeR} ${wedgeR} 0 0 1 ${wx2.toFixed(2)} ${wy2.toFixed(2)} Z`;

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 22,
        alignItems: 'start',
        margin: '4px 0',
      }}>
        {/* Dial column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <motion.div
            ref={dialRef}
            role="radiogroup"
            aria-label="Activity type"
            tabIndex={0}
            onPanStart={handleDialPanStart}
            onPan={handleDialPan}
            onPanEnd={handleDialPanEnd}
            onClick={handleDialClick}
            onKeyDown={handleDialKeyDown}
            onFocus={() => setDialFocused(true)}
            onBlur={() => setDialFocused(false)}
            style={{
              position: 'relative',
              width: 244,
              height: 244,
              borderRadius: '50%',
              border: `1px solid ${dialFocused ? 'rgba(6,182,212,0.6)' : 'rgba(6,182,212,0.2)'}`,
              background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)',
              boxShadow: dialFocused
                ? '0 0 0 3px rgba(6,182,212,0.12), inset 0 0 24px rgba(6,182,212,0.08)'
                : 'inset 0 0 24px rgba(6,182,212,0.06)',
              cursor: panning ? 'grabbing' : 'grab',
              outline: 'none',
              touchAction: 'none',
              userSelect: 'none',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
            }}
          >
            {/* Active wedge (fixed at top) */}
            <svg
              aria-hidden
              width="244"
              height="244"
              viewBox="-110 -110 220 220"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <path
                d={wedgePath}
                strokeWidth="1"
                style={{
                  fill: `${selectedColor}22`,
                  stroke: `${selectedColor}66`,
                  transition: 'fill 320ms ease, stroke 320ms ease',
                }}
              />
            </svg>

            {/* Rotating content */}
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                rotate: rotation,
                transformOrigin: 'center',
                zIndex: 2,
              }}
            >
              {/* Spokes */}
              <svg
                aria-hidden
                width="244"
                height="244"
                viewBox="-110 -110 220 220"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const angleRad = ((18 + i * 36) * Math.PI) / 180;
                  const innerR = 28;
                  const outerR = 98;
                  const x1 = innerR * Math.sin(angleRad);
                  const y1 = -innerR * Math.cos(angleRad);
                  const x2 = outerR * Math.sin(angleRad);
                  const y2 = -outerR * Math.cos(angleRad);
                  return (
                    <line
                      key={i}
                      x1={x1.toFixed(2)}
                      y1={y1.toFixed(2)}
                      x2={x2.toFixed(2)}
                      y2={y2.toFixed(2)}
                      stroke="rgba(6,182,212,0.14)"
                      strokeWidth="1"
                    />
                  );
                })}
              </svg>

              {/* Icons (pointerEvents none - dial handles clicks via angle math) */}
              {TYPE_META.map((meta, i) => (
                <DialIcon
                  key={meta.value}
                  meta={meta}
                  i={i}
                  isActive={type === meta.value}
                  dialRotation={rotation}
                />
              ))}
            </motion.div>

            {/* Hub label overlay */}
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 4, pointerEvents: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={type}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{
                    fontSize: 8,
                    fontFamily: 'var(--font-geist-mono)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: selectedColor,
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}
                >
                  {selectedMeta.label}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Indicator triangle at 12 o'clock (fixed) */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -4,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '9px solid rgb(6,182,212)',
                filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.8))',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            />
          </motion.div>

          {/* Hint */}
          <div
            aria-hidden
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.35)',
              textAlign: 'center',
              fontFamily: 'var(--font-sora)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Drag · Scroll · Click
          </div>
        </div>

        {/* Right column: compact detail card + priority */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Detail card */}
          <div style={{
            width: '100%',
            position: 'relative',
            borderRadius: 14,
            padding: 12,
            minHeight: 206,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            overflow: 'hidden',
            background: `radial-gradient(circle at center, ${selectedColor}14 0%, transparent 70%)`,
            border: `1px solid ${selectedColor}40`,
            boxShadow: `inset 0 0 20px ${selectedColor}10, 0 0 22px ${selectedColor}22`,
            transition: 'background 300ms ease, border-color 300ms ease, box-shadow 300ms ease',
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={type}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
              >
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: `${selectedColor}1a`,
                  border: `1.5px solid ${selectedColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 20px ${selectedColor}55, inset 0 0 12px ${selectedColor}22`,
                }}>
                  <SelectedIcon
                    size={26}
                    color={selectedColor}
                    strokeWidth={2}
                    style={{ filter: `drop-shadow(0 0 5px ${selectedColor}aa)` }}
                  />
                </div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: selectedColor,
                  fontFamily: 'var(--font-sora)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {selectedMeta.label}
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.55)',
                  fontFamily: 'var(--font-sora)',
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}>
                  {selectedMeta.desc}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Priority section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
                fontFamily: 'var(--font-sora)',
              }}>Priority</span>
              <button
                type="button"
                aria-label="Priority info"
                onMouseEnter={handleTooltipEnter}
                onMouseLeave={handleTooltipLeave}
                onFocus={(e) => handleTooltipEnter(e)}
                onBlur={handleTooltipLeave}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 14, height: 14, padding: 0,
                  background: 'transparent', border: 'none', cursor: 'help',
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                <Info size={11} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {PRIORITIES.map((p) => {
                const active = priority === p;
                const hovered = hoveredPriority === p && !active;
                const accent = PRIORITY_COLORS[p];
                const label = PRIORITY_LABELS[p];
                const background = active ? `${accent}20` : hovered ? `${accent}14` : `${accent}0a`;
                const borderValue = active ? `1.5px solid ${accent}` : hovered ? `1px solid ${accent}55` : `1px solid ${accent}30`;
                const color = active ? accent : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)';
                const boxShadow = active ? `0 0 12px ${accent}50, inset 0 0 8px ${accent}20` : 'none';
                return (
                  <motion.button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    onMouseEnter={() => setHoveredPriority(p)}
                    onMouseLeave={() => setHoveredPriority(null)}
                    whileTap={{ scale: 0.97 }}
                    aria-label={label}
                    aria-pressed={active}
                    style={{
                      padding: '6px 0',
                      borderRadius: 8,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      fontFamily: 'var(--font-sora)',
                      background,
                      border: borderValue,
                      color,
                      boxShadow,
                      cursor: 'pointer',
                      transition: 'background 200ms cubic-bezier(0.22, 1, 0.36, 1), border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWhatSection = () => (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.04, ease: EASE }}
      style={{ position: 'relative', zIndex: 1 }}
    >
      {sectionLabelRow(1, 'What')}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          ref={titleInputRef}
          placeholder="Activity title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={focusInput}
          onBlur={blurInput}
          aria-label="Activity title"
          style={inputBase}
        />

        <div style={{ position: 'relative' }}>
          <MapPin
            size={13}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
            }}
          />
          <input
            placeholder="Location (optional)"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            onFocus={focusInput}
            onBlur={blurInput}
            aria-label="Location"
            style={{ ...inputBase, paddingLeft: 34, fontSize: 13 }}
          />
        </div>

        {/* Rotating dial + detail card + priority */}
        {renderTypeDial()}
      </div>
    </motion.div>
  );

  const renderWhenSection = () => {
    const startMin = timeToMin(startTime);

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.08, ease: EASE }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        {sectionLabelRow(2, 'When')}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Time row: start ──── duration ──── end (combined) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                {/* Start time — interactive readout */}
                <div
                  ref={timeReadoutRef}
                  aria-label="Start time"
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 2,
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(6,182,212,0.32)',
                    userSelect: 'none',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {/* Hour — click to inline edit */}
                  {editingField === 'hour' ? (
                    <input
                      autoFocus
                      value={editBuffer}
                      onChange={(e) => setEditBuffer(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                        if (e.key === 'Escape') { e.preventDefault(); setEditingField(null); setEditBuffer(''); }
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault();
                          const num = parseInt(editBuffer, 10);
                          const [h24, m] = startTime.split(':').map(Number);
                          if (!isNaN(num)) {
                            let newH24: number;
                            if (num === 0 || num === 24) {
                              newH24 = 0;
                            } else if (num >= 13 && num <= 23) {
                              newH24 = num;
                            } else {
                              const isPm = h24 >= 12;
                              const clamped = Math.min(12, Math.max(1, num));
                              newH24 = isPm ? (clamped === 12 ? 12 : clamped + 12) : (clamped === 12 ? 0 : clamped);
                            }
                            setStartTime(`${String(newH24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                          }
                          setEditBuffer(String(m).padStart(2, '0'));
                          setEditingField('minute');
                        }
                      }}
                      style={{
                        fontSize: 32, fontFamily: 'var(--font-geist-mono)', fontWeight: 700,
                        color: 'rgb(245,158,11)', background: 'transparent',
                        border: 'none', outline: 'none',
                        width: 40, minWidth: 40, maxWidth: 40,
                        height: 32, minHeight: 32, maxHeight: 32,
                        boxSizing: 'border-box',
                        textAlign: 'center', padding: 0, margin: 0,
                        lineHeight: '32px',
                        verticalAlign: 'baseline',
                        display: 'inline-block',
                      }}
                    />
                  ) : (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Edit hour"
                      onClick={() => {
                        const [h24] = startTime.split(':').map(Number);
                        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                        setEditBuffer(String(h12).padStart(2, '0'));
                        setEditingField('hour');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const [h24] = startTime.split(':').map(Number);
                          const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                          setEditBuffer(String(h12).padStart(2, '0'));
                          setEditingField('hour');
                        }
                      }}
                      style={{
                        fontSize: 32, fontFamily: 'var(--font-geist-mono)', fontWeight: 700,
                        color: 'rgb(245,158,11)', cursor: 'text', outline: 'none',
                        width: 40, minWidth: 40, maxWidth: 40,
                        height: 32, minHeight: 32, maxHeight: 32,
                        boxSizing: 'border-box',
                        textAlign: 'center', display: 'inline-block',
                        lineHeight: '32px',
                        verticalAlign: 'baseline', padding: 0, margin: 0,
                        borderRadius: 4,
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {(() => {
                        const [h24] = startTime.split(':').map(Number);
                        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                        return String(h12).padStart(2, '0');
                      })()}
                    </span>
                  )}

                  <span style={{
                    fontSize: 32,
                    fontFamily: 'var(--font-geist-mono)',
                    color: 'rgba(245,158,11,0.45)',
                    lineHeight: '32px',
                    display: 'inline-block',
                    verticalAlign: 'baseline',
                    padding: 0,
                  }}>:</span>

                  {/* Minute — click to inline edit */}
                  {editingField === 'minute' ? (
                    <input
                      autoFocus
                      value={editBuffer}
                      onChange={(e) => setEditBuffer(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                        if (e.key === 'Escape') { e.preventDefault(); setEditingField(null); setEditBuffer(''); }
                        if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          const num = parseInt(editBuffer, 10);
                          const [h24] = startTime.split(':').map(Number);
                          if (!isNaN(num)) {
                            const clamped = Math.min(59, Math.max(0, num));
                            setStartTime(`${String(h24).padStart(2, '0')}:${String(clamped).padStart(2, '0')}`);
                          }
                          const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                          setEditBuffer(String(h12).padStart(2, '0'));
                          setEditingField('hour');
                        }
                      }}
                      style={{
                        fontSize: 32, fontFamily: 'var(--font-geist-mono)', fontWeight: 700,
                        color: 'rgb(245,158,11)', background: 'transparent',
                        border: 'none', outline: 'none',
                        width: 40, minWidth: 40, maxWidth: 40,
                        height: 32, minHeight: 32, maxHeight: 32,
                        boxSizing: 'border-box',
                        textAlign: 'center', padding: 0, margin: 0,
                        lineHeight: '32px',
                        verticalAlign: 'baseline',
                        display: 'inline-block',
                      }}
                    />
                  ) : (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Edit minute"
                      onClick={() => {
                        const [, m] = startTime.split(':').map(Number);
                        setEditBuffer(String(m).padStart(2, '0'));
                        setEditingField('minute');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const [, m] = startTime.split(':').map(Number);
                          setEditBuffer(String(m).padStart(2, '0'));
                          setEditingField('minute');
                        }
                      }}
                      style={{
                        fontSize: 32, fontFamily: 'var(--font-geist-mono)', fontWeight: 700,
                        color: 'rgb(245,158,11)', cursor: 'text', outline: 'none',
                        width: 40, minWidth: 40, maxWidth: 40,
                        height: 32, minHeight: 32, maxHeight: 32,
                        boxSizing: 'border-box',
                        textAlign: 'center', display: 'inline-block',
                        lineHeight: '32px',
                        verticalAlign: 'baseline', padding: 0, margin: 0,
                        borderRadius: 4,
                        transition: 'background 150ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {startTime.split(':')[1]}
                    </span>
                  )}

                  {/* AM/PM toggle */}
                  <button
                    type="button"
                    onClick={toggleAmPm}
                    style={{
                      fontSize: 12, fontFamily: 'var(--font-geist-mono)', fontWeight: 700,
                      color: 'rgba(245,158,11,0.75)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '2px 4px', marginLeft: 4,
                      borderRadius: 4, letterSpacing: '0.04em',
                      lineHeight: 1, alignSelf: 'flex-end', paddingBottom: 3,
                    }}
                  >
                    {(() => {
                      const [h24] = startTime.split(':').map(Number);
                      return h24 >= 12 ? 'PM' : 'AM';
                    })()}
                  </button>

                  {/* Clock icon — opens picker popover */}
                  <button
                    ref={clockBtnRef}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); pickerOpen ? closePicker() : openPicker(); }}
                    aria-label="Open time picker"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 22, height: 22, padding: 0, marginLeft: 6,
                      background: pickerOpen ? 'rgba(6,182,212,0.15)' : 'transparent',
                      border: `1px solid ${pickerOpen ? 'rgba(6,182,212,0.6)' : 'rgba(6,182,212,0.25)'}`,
                      borderRadius: 6,
                      color: pickerOpen ? 'rgb(6,182,212)' : 'rgba(6,182,212,0.7)',
                      cursor: 'pointer',
                      alignSelf: 'center',
                      transition: 'all 160ms ease',
                    }}
                    onMouseEnter={(e) => { if (!pickerOpen) { e.currentTarget.style.background = 'rgba(6,182,212,0.08)'; e.currentTarget.style.color = 'rgb(6,182,212)'; }}}
                    onMouseLeave={(e) => { if (!pickerOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(6,182,212,0.7)'; }}}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </button>
                </div>

                {/* Duration connector */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  <span style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 11,
                    fontFamily: 'var(--font-geist-mono)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.06em',
                  }}>
                    {formatDuration(duration)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>

                {/* End time */}
                <span
                  style={{
                    color: 'rgba(245,158,11,0.85)',
                    fontSize: 32,
                    fontWeight: 700,
                    fontFamily: 'var(--font-geist-mono)',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {formatHour12(endTime)}
                </span>
              </div>

          {/* Duration preset chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(['30', '60', '120', '180'] as const).map((key) => {
              const active = durationPreset === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  onClick={() => {
                    setDurationPreset(key);
                    setDuration(DURATION_PRESET_VALUES[key]);
                  }}
                  whileTap={{ scale: 0.96 }}
                  aria-label={`Duration ${DURATION_PRESET_LABELS[key]}`}
                  aria-pressed={active}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 7,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-geist-mono)',
                    background: active ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.025)',
                    border: active ? '1.5px solid rgba(6,182,212,0.75)' : '1px solid rgba(255,255,255,0.08)',
                    color: active ? 'rgb(6,182,212)' : 'rgba(255,255,255,0.5)',
                    boxShadow: active ? '0 0 10px rgba(6,182,212,0.35)' : 'none',
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    transition: 'background 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  {DURATION_PRESET_LABELS[key]}
                </motion.button>
              );
            })}
          </div>

          {/* Scrubber track */}
          <div>
            <div
              ref={trackRef}
              style={{
                position: 'relative',
                height: 64,
                width: '100%',
                borderRadius: 10,
                overflow: 'hidden',
                userSelect: 'none',
                touchAction: 'pan-y',
                background:
                  'linear-gradient(90deg, rgba(14,24,56,0.85) 0%, rgba(106,58,88,0.75) 22%, rgba(142,194,232,0.7) 28%, rgba(114,182,232,0.7) 50%, rgba(164,200,220,0.7) 72%, rgba(232,131,62,0.75) 79%, rgba(22,24,56,0.85) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {/* 6-hour vertical dividers */}
              {[25, 50, 75].map((pct) => (
                <div
                  key={`div-${pct}`}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'rgba(255,255,255,0.12)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />
              ))}

              {/* In-track hour labels */}
              {[
                { pct: 0, label: '12a', align: 'left' as const },
                { pct: 25, label: '6a', align: 'center' as const },
                { pct: 50, label: '12p', align: 'center' as const },
                { pct: 75, label: '6p', align: 'center' as const },
                { pct: 100, label: '12a', align: 'right' as const },
              ].map(({ pct, label, align }) => (
                <span
                  key={`inlabel-${pct}`}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    bottom: 4,
                    transform: align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : 'none',
                    fontSize: 8,
                    fontFamily: 'var(--font-geist-mono)',
                    color: 'rgba(255,255,255,0.45)',
                    letterSpacing: '0.04em',
                    pointerEvents: 'none',
                    zIndex: 2,
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
              ))}

              {/* Ambient day/night icons */}
              {[
                { pct: 5, Icon: Moon, color: 'rgba(200,210,255,0.75)', size: 14 },
                { pct: 25, Icon: Sunrise, color: 'rgba(232,180,120,0.90)', size: 14 },
                { pct: 50, Icon: Sun, color: 'rgba(255,220,120,1.0)', size: 16 },
                { pct: 77, Icon: Sunset, color: 'rgba(232,140,80,0.90)', size: 14 },
                { pct: 95, Icon: Moon, color: 'rgba(200,210,255,0.75)', size: 14 },
              ].map(({ pct, Icon, color, size }, i) => (
                <div
                  key={`ambient-${i}`}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    top: 7,
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                    lineHeight: 0,
                    zIndex: 2,
                    filter: `drop-shadow(0 0 5px ${color})`,
                  }}
                >
                  <Icon size={size} color={color} strokeWidth={1.8} />
                </div>
              ))}

              {/* Existing pills (grey, read-only) */}
              {existingForDay.map((it, idx) => {
                const iStart = timeToMin(it.start_time!);
                const iDur = it.end_time
                  ? timeToMin(it.end_time) - iStart
                  : it.duration_minutes ?? 60;
                const left = (iStart / 1440) * 100;
                const width = Math.max((iDur / 1440) * 100, 0.8);
                return (
                  <div
                    key={it.id ?? `existing-${idx}`}
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 22,
                      height: 20,
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.22)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  />
                );
              })}

              {/* Draggable amber block */}
              <motion.div
                role="slider"
                aria-label="Start time"
                aria-valuemin={0}
                aria-valuemax={1440 - duration}
                aria-valuenow={startMin}
                aria-valuetext={`${formatHour12(startTime)} to ${formatHour12(endTime)}`}
                tabIndex={0}
                drag="x"
                dragConstraints={{ left: 0, right: maxX }}
                dragElastic={0}
                dragMomentum={false}
                onDragStart={() => { setDragging(true); dragStartTimeRef.current = startTime; }}
                onDrag={handleDrag}
                onDragEnd={() => { setDragging(false); }}
                onKeyDown={handleScrubberKeyDown}
                onFocus={() => setScrubberFocused(true)}
                onBlur={() => setScrubberFocused(false)}
                whileHover={{ scale: 1.02 }}
                style={{
                  position: 'absolute',
                  top: 18,
                  left: 0,
                  x,
                  width: blockWidthPx || 0,
                  height: 28,
                  borderRadius: 6,
                  background: 'linear-gradient(180deg, rgba(251,191,36,0.92) 0%, rgba(245,158,11,0.88) 100%)',
                  border: '1.5px solid rgb(245,158,11)',
                  boxShadow: scrubberFocused
                    ? '0 0 0 3px rgba(245,158,11,0.25), 0 0 16px rgba(245,158,11,0.65), inset 0 1px 0 rgba(255,255,255,0.4)'
                    : '0 0 14px rgba(245,158,11,0.6), inset 0 1px 0 rgba(255,255,255,0.4)',
                  cursor: dragging ? 'grabbing' : 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  zIndex: 3,
                  outline: 'none',
                }}
              >
                <span style={{ width: 1.5, height: 12, background: 'rgba(10,10,10,0.4)', borderRadius: 1 }} />
                <span style={{ width: 1.5, height: 12, background: 'rgba(10,10,10,0.4)', borderRadius: 1 }} />
                <span style={{ width: 1.5, height: 12, background: 'rgba(10,10,10,0.4)', borderRadius: 1 }} />
              </motion.div>
            </div>

            {/* Hour tick labels */}
            <div style={{
              position: 'relative',
              height: 12,
              marginTop: 4,
              width: '100%',
            }}>
              {[
                { pct: 0, label: '12a', align: 'start' },
                { pct: 25, label: '6a', align: 'center' },
                { pct: 50, label: '12p', align: 'center' },
                { pct: 75, label: '6p', align: 'center' },
                { pct: 100, label: '12a', align: 'end' },
              ].map(({ pct, label, align }) => (
                <span
                  key={`tick-${pct}`}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    top: 0,
                    transform:
                      align === 'start'
                        ? 'translateX(0)'
                        : align === 'end'
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                    fontSize: 10,
                    fontFamily: 'var(--font-geist-mono)',
                    color: 'rgba(255,255,255,0.55)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Conflict warning — fixed height prevents layout shift */}
          <div style={{ height: 36, position: 'relative' }}>
            <AnimatePresence initial={false}>
              {conflict && (
                <motion.div
                  key="conflict"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: 'absolute', inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.4)',
                    color: 'rgb(245,158,11)',
                    fontSize: 11,
                    fontWeight: 500,
                    fontFamily: 'var(--font-sora)',
                  }}
                >
                  <AlertTriangle size={11} />
                  <span>Overlaps with {conflict.title || 'existing activity'}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderFooter = () => {
    const disabled = submitting || submitSuccess || !title.trim();
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.12, ease: EASE }}
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
          marginTop: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {submitError && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              marginRight: 'auto',
              fontSize: 11,
              fontWeight: 500,
              color: 'rgb(239,68,68)',
              fontFamily: 'var(--font-sora)',
            }}
          >
            <AlertTriangle size={11} />
            <span>{submitError}</span>
          </motion.div>
        )}
        <button
          onClick={onClose}
          type="button"
          style={{
            padding: '9px 16px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-sora)',
            transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
          }}
        >
          Cancel
        </button>

        <motion.button
          onClick={handleSubmit}
          type="button"
          disabled={disabled}
          onHoverStart={() => setBtnHovered(true)}
          onHoverEnd={() => setBtnHovered(false)}
          whileHover={
            disabled
              ? undefined
              : {
                  scale: 1.02,
                  boxShadow:
                    '0 6px 22px rgba(245,158,11,0.6), inset 0 1px 0 rgba(255,255,255,0.32)',
                }
          }
          whileTap={disabled ? undefined : { scale: 0.97 }}
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-sora)',
            color: 'rgb(10,10,10)',
            background: submitSuccess
              ? 'linear-gradient(180deg, rgb(74,222,128) 0%, rgb(34,197,94) 100%)'
              : 'linear-gradient(180deg, rgb(251,191,36) 0%, rgb(245,158,11) 100%)',
            boxShadow: submitSuccess
              ? '0 4px 14px rgba(34,197,94,0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
              : '0 4px 14px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
            opacity: disabled && !submitSuccess ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 112,
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            letterSpacing: '0.02em',
            transition: 'opacity 160ms ease, background 220ms ease, box-shadow 220ms ease',
          }}
        >
          {!disabled && (
            <motion.div
              aria-hidden
              initial={false}
              animate={{ x: btnHovered ? '200%' : '-100%' }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background:
                  'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.32) 50%, transparent 60%)',
                pointerEvents: 'none',
              }}
            />
          )}

          {submitSuccess ? (
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.4 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, position: 'relative', zIndex: 1 }}
            >
              <Check size={14} strokeWidth={2.5} />
              <span>Added</span>
            </motion.span>
          ) : submitting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 }}>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
                style={{ display: 'inline-flex' }}
              >
                <Loader2 size={13} strokeWidth={2.2} />
              </motion.span>
              <span>Adding…</span>
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
              zIndex: 1,
            }}>
              <span>Add</span>
              <motion.span
                animate={{ rotate: btnHovered ? 15 : 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <Sparkles size={13} strokeWidth={2.2} />
              </motion.span>
              <motion.span
                aria-hidden
                animate={{ opacity: btnHovered ? 0 : 1, x: btnHovered ? -4 : 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: 10,
                  fontFamily: 'var(--font-geist-mono)',
                  color: 'rgba(10,10,10,0.75)',
                  letterSpacing: '0.04em',
                  marginLeft: 2,
                  lineHeight: 1.2,
                }}
              >
                ⌘↵
              </motion.span>
            </span>
          )}
        </motion.button>
      </motion.div>
    );
  };

  const picker = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {pickerOpen && pickerRect && (
        <>
          <motion.div
            key="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={closePicker}
            style={{
              position: 'fixed', inset: 0, zIndex: 10001,
              background: 'transparent',
            }}
          />
          <motion.div
            key="picker-popover"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: pickerRect.left,
              top: pickerRect.top,
              minWidth: 320,
              zIndex: 10002,
              padding: 14,
              background: 'rgba(12,15,22,0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(6,182,212,0.4)',
              borderRadius: 12,
              boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(6,182,212,0.18)',
              fontFamily: 'var(--font-sora)',
            }}
          >
            <div aria-hidden style={{
              position: 'absolute', top: 0, left: 14, right: 14, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), transparent)',
            }} />
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                color: 'rgba(6,182,212,0.85)', textTransform: 'uppercase',
                fontFamily: 'var(--font-sora)',
              }}>
                Set time
              </div>
              <div style={{
                fontSize: 11, fontFamily: 'var(--font-geist-mono)',
                color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em',
              }}>
                {(() => {
                  const [h24, m] = startTime.split(':').map(Number);
                  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
                })()}
              </div>
            </div>

            {/* Hour + Minute sliders stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* HOUR slider */}
              {(() => {
                const [h24] = startTime.split(':').map(Number);
                const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                return (
                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      marginBottom: 6,
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '0.14em',
                        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
                        fontFamily: 'var(--font-sora)',
                      }}>
                        Hour
                      </span>
                      <span style={{
                        fontSize: 22, fontWeight: 700,
                        fontFamily: 'var(--font-geist-mono)',
                        color: 'rgb(245,158,11)',
                        lineHeight: 1,
                      }}>
                        {String(h12).padStart(2, '0')}
                      </span>
                    </div>
                    <div style={{
                      position: 'relative',
                      height: 32,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(6,182,212,0.15)',
                      borderRadius: 6,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, 1fr)',
                      overflow: 'hidden',
                    }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const hourValue = i + 1;
                        const active = hourValue === h12;
                        return (
                          <button
                            key={hourValue}
                            type="button"
                            onClick={() => {
                              const [curH24, curM] = startTime.split(':').map(Number);
                              const isPm = curH24 >= 12;
                              const newH24 = isPm
                                ? (hourValue === 12 ? 12 : hourValue + 12)
                                : (hourValue === 12 ? 0 : hourValue);
                              setStartTime(`${String(newH24).padStart(2, '0')}:${String(curM).padStart(2, '0')}`);
                            }}
                            style={{
                              background: active ? 'rgba(245,158,11,0.25)' : 'transparent',
                              border: 'none',
                              borderRight: i < 11 ? '1px solid rgba(6,182,212,0.08)' : 'none',
                              color: active ? 'rgb(245,158,11)' : 'rgba(255,255,255,0.5)',
                              fontSize: 10,
                              fontFamily: 'var(--font-geist-mono)',
                              fontWeight: active ? 700 : 500,
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 140ms ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!active) e.currentTarget.style.background = 'rgba(6,182,212,0.08)';
                            }}
                            onMouseLeave={(e) => {
                              if (!active) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {hourValue}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* MINUTE slider — same pattern, 12 slots of 5-minute increments */}
              {(() => {
                const [, m] = startTime.split(':').map(Number);
                const snappedToSlot = Math.round(m / 5) * 5;
                return (
                  <div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      marginBottom: 6,
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '0.14em',
                        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
                        fontFamily: 'var(--font-sora)',
                      }}>
                        Minute
                      </span>
                      <span style={{
                        fontSize: 22, fontWeight: 700,
                        fontFamily: 'var(--font-geist-mono)',
                        color: 'rgb(245,158,11)',
                        lineHeight: 1,
                      }}>
                        {String(m).padStart(2, '0')}
                      </span>
                    </div>
                    <div style={{
                      position: 'relative',
                      height: 32,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(6,182,212,0.15)',
                      borderRadius: 6,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, 1fr)',
                      overflow: 'hidden',
                    }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const minValue = i * 5;
                        const active = minValue === snappedToSlot;
                        return (
                          <button
                            key={minValue}
                            type="button"
                            onClick={() => {
                              const [curH24] = startTime.split(':').map(Number);
                              setStartTime(`${String(curH24).padStart(2, '0')}:${String(minValue).padStart(2, '0')}`);
                            }}
                            style={{
                              background: active ? 'rgba(245,158,11,0.25)' : 'transparent',
                              border: 'none',
                              borderRight: i < 11 ? '1px solid rgba(6,182,212,0.08)' : 'none',
                              color: active ? 'rgb(245,158,11)' : 'rgba(255,255,255,0.5)',
                              fontSize: 10,
                              fontFamily: 'var(--font-geist-mono)',
                              fontWeight: active ? 700 : 500,
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 140ms ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!active) e.currentTarget.style.background = 'rgba(6,182,212,0.08)';
                            }}
                            onMouseLeave={(e) => {
                              if (!active) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {String(minValue).padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* AM / PM toggle — segmented control */}
              {(() => {
                const [h24] = startTime.split(':').map(Number);
                const isPm = h24 >= 12;
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 0,
                    padding: 3,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(6,182,212,0.15)',
                    borderRadius: 8,
                    position: 'relative',
                  }}>
                    {(['AM', 'PM'] as const).map((period) => {
                      const active = (period === 'PM') === isPm;
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => { if ((period === 'PM') !== isPm) toggleAmPm(); }}
                          style={{
                            padding: '8px 0',
                            fontSize: 11, fontWeight: 700,
                            fontFamily: 'var(--font-geist-mono)',
                            letterSpacing: '0.12em',
                            background: active ? 'rgba(245,158,11,0.2)' : 'transparent',
                            border: active ? '1px solid rgba(245,158,11,0.6)' : '1px solid transparent',
                            color: active ? 'rgb(245,158,11)' : 'rgba(255,255,255,0.45)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            transition: 'all 160ms ease',
                          }}
                        >
                          {period}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Done button */}
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                type="button"
                onClick={closePicker}
                style={{
                  padding: '6px 16px',
                  fontSize: 11, fontWeight: 600,
                  fontFamily: 'var(--font-sora)',
                  letterSpacing: '0.06em',
                  background: 'linear-gradient(180deg, rgba(6,182,212,0.22) 0%, rgba(6,182,212,0.12) 100%)',
                  border: '1px solid rgba(6,182,212,0.55)',
                  color: 'rgb(6,182,212)',
                  borderRadius: 7,
                  cursor: 'pointer',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(6,182,212,0.2)',
                }}
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );

  const priorityTooltip = tooltipRect && typeof document !== 'undefined'
    ? createPortal(
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18, ease: EASE }}
          style={{
            position: 'fixed',
            left: tooltipRect.left,
            top: tooltipRect.top - 8,
            transform: 'translate(-50%, -100%)',
            maxWidth: 240,
            padding: '8px 10px',
            background: 'rgba(12,15,22,0.98)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(6,182,212,0.35)',
            borderRadius: 8,
            boxShadow: '0 10px 28px rgba(0,0,0,0.6), 0 0 16px rgba(6,182,212,0.15)',
            pointerEvents: 'none',
            zIndex: 10000,
            fontFamily: 'var(--font-sora)',
            fontSize: 11,
            lineHeight: 1.45,
            color: 'rgba(255,255,255,0.88)',
          }}
        >
          <div><span style={{ color: PRIORITY_COLORS.must_do, fontWeight: 600 }}>Must:</span> locked in plan.</div>
          <div><span style={{ color: PRIORITY_COLORS.nice_to_have, fontWeight: 600 }}>Nice:</span> can be rearranged.</div>
          <div><span style={{ color: PRIORITY_COLORS.flexible, fontWeight: 600 }}>Flex:</span> AI can replace.</div>
        </motion.div>,
        document.body
      )
    : null;

  return (
    <>
      {/* Inject keyframe styles once per dialog mount — kept outside the backdrop motion.div
          so they are available immediately and not recreated inside the animated subtree. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .aa-no-spin::-webkit-outer-spin-button,
        .aa-no-spin::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .aa-no-spin {
          -moz-appearance: textfield;
          appearance: textfield;
        }
        @keyframes aaSectionPulse {
          0% { box-shadow: 0 0 0 0 rgba(6,182,212,0.5); }
          100% { box-shadow: 0 0 0 8px rgba(6,182,212,0); }
        }
        .aa-section-badge {
          animation: aaSectionPulse 1.2s ease-out;
        }
      `}} />
      {picker}
      <AnimatePresence
        onExitComplete={() => {
          const item = pendingItemRef.current;
          if (!item) return;
          pendingItemRef.current = null;
          setTimeout(() => {
            const store = useTripStore.getState();
            store.insertPlanItemLocal(item);
            store.markAsRecentlyAdded(item.id);
          }, 200);
        }}
      >
        {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(12px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
            padding: 20,
          }}
        >

        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ scale: 0.94, y: 10, opacity: 0 }}
          animate={{
            scale: submitSuccess ? [1, 1.015, 1] : 1,
            y: 0,
            opacity: 1,
          }}
          exit={{ scale: 0.94, y: 10, opacity: 0 }}
          transition={{
            scale: submitSuccess ? { duration: 0.2, times: [0, 0.5, 1] } : { duration: 0.28, ease: EASE },
            default: { duration: 0.28, ease: EASE },
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 580,
            maxWidth: '94vw',
            maxHeight: '92vh',
            padding: 1,
            borderRadius: 16,
            background:
              'linear-gradient(135deg, rgba(6,182,212,0.4) 0%, rgba(245,158,11,0.3) 50%, rgba(167,139,250,0.3) 100%)',
            boxShadow: dialogBoxShadow,
            fontFamily: 'var(--font-sora)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'box-shadow 280ms ease',
          }}
        >
          <div
            style={{
              borderRadius: 15,
              background: 'rgba(12,15,22,0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '22px 24px 20px',
              maxHeight: 'calc(92vh - 2px)',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            {/* Amber top accent line */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 20,
                right: 20,
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.55), transparent)',
                pointerEvents: 'none',
              }}
            />

            {/* Cyan dot grid bg */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle, rgba(6,182,212,0.06) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                opacity: 0.4,
                pointerEvents: 'none',
                borderRadius: 'inherit',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
              {renderHeader()}
              {renderWhatSection()}

              {renderWhenSection()}
              {renderFooter()}
            </div>
          </div>
        </motion.div>

          {priorityTooltip}
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
