'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Map, Footprints } from 'lucide-react'
import { useTripStore } from '@/store/tripStore'
import { useUIStore } from '@/store/uiStore'
import { getActivityColor } from '@/lib/activityColors'

// TODO(phase-2): integrate @googlemaps/js-api-loader for real pins

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export default function MapTab() {
  const { planItems } = useTripStore()
  const { selectedDate } = useUIStore()

  const dayItems = useMemo(() => {
    if (!selectedDate) return []
    return planItems
      // Normalize date to YYYY-MM-DD for consistent comparison across tabs
      .filter(item => item.date?.slice(0, 10) === selectedDate)
      .sort((a, b) => {
        if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time)
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })
  }, [planItems, selectedDate])

  const fauxPins = dayItems.filter(i => i.latitude || i.longitude).slice(0, 5)
  const mapSubtext = !selectedDate
    ? 'Select a date to view the map'
    : `${dayItems.length} activit${dayItems.length !== 1 ? 'ies' : 'y'} for this day`

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
      {/* Left: map canvas placeholder */}
      <div
        style={{
          height: '100%', borderRadius: 12, position: 'relative', overflow: 'hidden',
          backgroundColor: '#0a0d14',
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.05) 1px, transparent 1px),
            radial-gradient(ellipse at center, rgba(6,182,212,0.08) 0%, transparent 70%)
          `,
          backgroundSize: '40px 40px, 40px 40px, 100% 100%',
          border: '1px solid rgba(6,182,212,0.08)',
        }}
      >
        {/* Center placeholder */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <Map size={48} color="rgba(6,182,212,0.3)" style={{ marginBottom: 12 }} />
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
            Map integration coming soon
          </span>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            {mapSubtext}
          </span>
        </div>

        {/* Faux pins — clamped to percentage-based positions so they stay in bounds */}
        {fauxPins.map((item, idx) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: `${10 + idx * 15}%`,
              top: `${15 + idx * 12}%`,
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: getActivityColor(item.activity_type),
              border: '2px solid rgba(12,15,22,0.8)',
              boxShadow: `0 0 12px ${getActivityColor(item.activity_type)}66`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>
              {idx + 1}
            </span>
          </div>
        ))}

        {/* Top overlay toolbar */}
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12,
          display: 'flex', justifyContent: 'space-between', pointerEvents: 'none',
        }}>
          {[
            { text: 'Day view' },
            { text: `${dayItems.length} stops` },
          ].map(({ text }) => (
            <div key={text} style={{
              fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(12,15,22,0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(6,182,212,0.2)',
              padding: '6px 12px', borderRadius: 8,
            }}>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Right: side panel */}
      <div style={{
        background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.08)',
        borderRadius: 12, padding: 16, height: '100%',
        display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto',
        boxSizing: 'border-box',
      }}>
        {/* Route summary */}
        <div>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>
            Route Summary
          </span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[{ label: 'DISTANCE', value: '— km' }, { label: 'TRAVEL TIME', value: '—' }].map(({ label, value }) => (
              <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 10 }}>
                <span style={{ display: 'block', fontFamily: 'var(--font-sora)', fontSize: 9, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                  {label}
                </span>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

        {/* Stops */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            Stops
          </span>
          {dayItems.length === 0 ? (
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              No stops to show
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {dayItems.map((item, idx) => (
                <div key={item.id}>
                  <motion.div
                    whileHover={{ backgroundColor: 'rgba(6,182,212,0.06)' }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, backgroundColor: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 700, color: 'rgb(6,182,212)' }}>{idx + 1}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontFamily: 'var(--font-sora)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                        {item.start_time ? formatTime(item.start_time) : '—'}
                      </span>
                    </div>
                    {idx < dayItems.length - 1 && (
                      <span style={{ fontFamily: 'var(--font-sora)', fontSize: 14, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>→</span>
                    )}
                  </motion.div>
                  {idx < dayItems.length - 1 && (
                    <div style={{ margin: '2px 0 2px 32px', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.35)' }}>
                      <Footprints size={10} />
                      <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11 }}>— min walk</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Note */}
        <div style={{ padding: 10, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.3)' }}>
            Drop pins and drag to reorder once map is live
          </span>
        </div>
      </div>
    </div>
  )
}
