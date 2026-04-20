'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTripStore } from '@/store/tripStore';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  prefillStartTime?: string;
  prefillDurationMinutes?: number;
}

const ACTIVITY_TYPES = ['sightseeing', 'food', 'activity', 'transport', 'accommodation'] as const;
const PRIORITIES = ['must_do', 'nice_to_have', 'flexible'] as const;

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export default function AddActivityDialog({ open, onClose, selectedDate, prefillStartTime, prefillDurationMinutes = 60 }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<typeof ACTIVITY_TYPES[number]>('activity');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('flexible');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [cost, setCost] = useState(0);
  const [locationName, setLocationName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addPlanItem = useTripStore((s) => s.addPlanItem);

  useEffect(() => {
    if (open) {
      setTitle('');
      setType('activity');
      setPriority('flexible');
      setStartTime(prefillStartTime ?? '09:00');
      setDuration(prefillDurationMinutes);
      setCost(0);
      setLocationName('');
    }
  }, [open, prefillStartTime, prefillDurationMinutes]);

  if (!open) return null;

  const endTime = addMinutes(startTime, duration);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addPlanItem({
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
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}
      >
        <motion.div
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 460, maxWidth: '92vw',
            background: 'rgba(12,15,22,0.98)',
            border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 14,
            padding: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(6,182,212,0.1)',
            display: 'flex', flexDirection: 'column', gap: 14,
            fontFamily: 'var(--font-sora)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Add activity</div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex' }}><X size={16} /></button>
          </div>

          <input
            autoFocus
            placeholder="Activity title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.95)',
              fontSize: 14, fontFamily: 'var(--font-sora)',
            }}
          />

          <input
            placeholder="Location (optional)"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.95)',
              fontSize: 13, fontFamily: 'var(--font-sora)',
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Start</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.95)', fontSize: 13,
              }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Duration (min)</span>
              <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.95)', fontSize: 13,
              }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as typeof ACTIVITY_TYPES[number])} style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.95)', fontSize: 12,
              }}>
                {ACTIVITY_TYPES.map(t => <option key={t} value={t} style={{ background: '#0c0f16' }}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as typeof PRIORITIES[number])} style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.95)', fontSize: 12,
              }}>
                {PRIORITIES.map(p => <option key={p} value={p} style={{ background: '#0c0f16' }}>{p.replace('_', ' ')}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cost</span>
              <input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.95)', fontSize: 13,
              }} />
            </label>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
            Ends at {endTime}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
              fontFamily: 'var(--font-sora)',
            }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting || !title.trim()} style={{
              padding: '8px 14px', borderRadius: 8,
              background: 'rgb(245,158,11)',
              border: 'none',
              color: 'rgb(10,10,10)',
              cursor: submitting || !title.trim() ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 600,
              opacity: submitting || !title.trim() ? 0.5 : 1,
              fontFamily: 'var(--font-sora)',
            }}>{submitting ? 'Adding…' : 'Add'}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
