'use client'

import { useMemo } from 'react'
import { Sun, Cloud, CloudRain, CloudSnow, CheckCircle2, Circle } from 'lucide-react'
import { useTripStore } from '@/store/tripStore'
import { useUIStore } from '@/store/uiStore'
import { getActivityColor } from '@/lib/activityColors'

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const current = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  while (current <= endDate) {
    days.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  return days
}

function getWeatherForIdx(idx: number) {
  const cycle = idx % 4
  if (cycle === 0 || cycle === 2) return { icon: Sun, color: 'rgba(251,191,36,0.7)', label: 'sunny' }
  if (cycle === 1) return { icon: Cloud, color: 'rgba(255,255,255,0.5)', label: 'cloudy' }
  return { icon: CloudRain, color: 'rgba(96,165,250,0.7)', label: 'rainy' }
}

const OUTDOOR_TYPES = new Set(['sightseeing', 'activity'])

export default function WeatherTab() {
  const { tripPlan, planItems } = useTripStore()
  const { selectedDate, setSelectedDate } = useUIStore()

  const dayItems = useMemo(() => {
    if (!selectedDate) return []
    return planItems
      .filter(item => item.date === selectedDate)
      .sort((a, b) => {
        if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time)
        return a.sort_order - b.sort_order
      })
  }, [planItems, selectedDate])

  const tripDays = useMemo(() => {
    if (!tripPlan) return []
    return getDaysInRange(tripPlan.start_date, tripPlan.end_date)
  }, [tripPlan])

  const hourlyTemps = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) =>
      Math.round(55 + Math.sin((i / 24) * Math.PI * 2) * 10 + 8)
    )
  }, [])

  if (!tripPlan) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sora)', fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>
          No trip loaded
        </span>
      </div>
    )
  }

  // SVG curve
  const minTemp = Math.min(...hourlyTemps) - 5
  const maxTemp = Math.max(...hourlyTemps) + 5
  const range = maxTemp - minTemp
  const mapY = (t: number) => 140 - ((t - minTemp) / range) * 100 - 20

  const pathPoints = hourlyTemps.map((t, i) => {
    const x = (i / 23) * 600
    const y = mapY(t)
    return `${x},${y}`
  })

  const curvePath = `M 0,${mapY(hourlyTemps[0])} ` + hourlyTemps.slice(1).map((t, i) => `L ${((i + 1) / 23) * 600},${mapY(t)}`).join(' ')
  const fillPath = `M 0 140 L ${curvePath.slice(2)} L 600 140 Z`

  const HOUR_LABELS = [
    { label: '12a', x: 0 },
    { label: '6a', x: (6 / 24) * 600 },
    { label: '12p', x: (12 / 24) * 600 },
    { label: '6p', x: (18 / 24) * 600 },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      {/* Section 1: Multi-day forecast strip */}
      <div style={{ background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.08)', borderRadius: 12, padding: 16, flexShrink: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
          Forecast
        </span>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {tripDays.map((date, idx) => {
            const weather = getWeatherForIdx(idx)
            const WeatherIcon = weather.icon
            const isSelected = date === selectedDate
            const dateObj = new Date(date + 'T00:00:00')
            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
            const day = dateObj.getDate()
            const high = 72 + (idx % 3)
            const low = 58 + (idx % 3)

            return (
              <div
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  flex: 1, minWidth: 80, cursor: 'pointer', borderRadius: 10, padding: 10,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: isSelected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  border: isSelected ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{weekday}</span>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{day}</span>
                <WeatherIcon size={20} color={weather.color} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>{high}°</span>
                  <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>{low}°</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 2: Hourly temperature curve */}
      <div style={{ background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.08)', borderRadius: 12, padding: 20, flexShrink: 0, height: 200, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>Hourly</span>
          <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>°F</span>
        </div>
        <svg width="100%" height="140" viewBox="0 0 600 140" preserveAspectRatio="none">
          <path d={fillPath} fill="rgba(245,158,11,0.08)" />
          <path d={curvePath} fill="none" stroke="rgb(245,158,11)" strokeWidth="2" strokeLinejoin="round" />
          {HOUR_LABELS.map(({ label, x }) => (
            <text key={label} x={x} y={135} fontSize="9" fill="rgba(255,255,255,0.4)" fontFamily="monospace" textAnchor={x === 0 ? 'start' : x >= 590 ? 'end' : 'middle'}>
              {label}
            </text>
          ))}
          {dayItems.filter(i => i.start_time).map((item) => {
            const x = (toMinutes(item.start_time!) / 1440) * 600
            const color = getActivityColor(item.activity_type)
            return (
              <line key={item.id} x1={x} y1={15} x2={x} y2={125} stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            )
          })}
        </svg>
      </div>

      {/* Section 3: Activity weather fit */}
      <div style={{ background: 'rgba(6,182,212,0.03)', border: '1px solid rgba(6,182,212,0.08)', borderRadius: 12, padding: 16, flex: 1, minHeight: 0, overflow: 'auto' }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-sora)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
          Activity Fit
        </span>
        {dayItems.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
            <span style={{ fontFamily: 'var(--font-sora)', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No activities planned for this day</span>
          </div>
        ) : (
          dayItems.map((item) => {
            const dayIdx = tripDays.indexOf(selectedDate ?? '')
            const weather = getWeatherForIdx(dayIdx)
            const isOutdoor = OUTDOOR_TYPES.has(item.activity_type)
            const isIndoor = item.activity_type === 'food' || item.activity_type === 'accommodation'

            let statusText: string
            let statusColor: string
            let StatusIcon: React.ElementType

            if (weather.label === 'rainy' && isOutdoor) {
              statusText = 'Rain expected — consider indoor alternatives'
              statusColor = 'rgb(239,68,68)'
              StatusIcon = CloudRain
            } else if (isIndoor) {
              statusText = 'Indoor — weather independent'
              statusColor = 'rgba(255,255,255,0.45)'
              StatusIcon = Circle
            } else if (weather.label === 'sunny' && isOutdoor) {
              statusText = 'Great weather for outdoor activity'
              statusColor = 'rgb(34,197,94)'
              StatusIcon = CheckCircle2
            } else {
              statusText = 'Mild conditions'
              statusColor = 'rgba(255,255,255,0.55)'
              StatusIcon = Circle
            }

            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', width: 60, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {item.start_time ? formatTime(item.start_time) : '—'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-sora)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sora)', fontSize: 11, fontWeight: 500, color: statusColor }}>
                    {statusText}
                  </span>
                </div>
                <StatusIcon size={14} color={statusColor} style={{ flexShrink: 0 }} />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
