import { CSSProperties } from 'react'

const LABELS = [
  { pct: 0,    text: '12 AM', anchor: 'start'  as const },
  { pct: 12.5, text: '3 AM',  anchor: 'center' as const },
  { pct: 25,   text: '6 AM',  anchor: 'center' as const },
  { pct: 37.5, text: '9 AM',  anchor: 'center' as const },
  { pct: 50,   text: 'NOON',  anchor: 'center' as const },
  { pct: 62.5, text: '3 PM',  anchor: 'center' as const },
  { pct: 75,   text: '6 PM',  anchor: 'center' as const },
  { pct: 87.5, text: '9 PM',  anchor: 'center' as const },
  { pct: 100,  text: '12 AM', anchor: 'end'    as const },
]

const containerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: 'rgba(6, 182, 212, 0.04)',
  borderTop: '0.5px solid rgba(6, 182, 212, 0.12)',
  borderBottom: '0.5px solid rgba(6, 182, 212, 0.12)',
}

const baseLabel: CSSProperties = {
  position: 'absolute',
  top: '50%',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '14px',
  fontWeight: 500,
  color: 'rgba(255, 255, 255, 0.9)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  letterSpacing: '0.02em',
}

function labelStyle(pct: number, anchor: 'start' | 'center' | 'end'): CSSProperties {
  if (anchor === 'start') return { ...baseLabel, left: '8px',  transform: 'translateY(-50%)' }
  if (anchor === 'end')   return { ...baseLabel, right: '8px', transform: 'translateY(-50%)' }
  return { ...baseLabel, left: `${pct}%`, transform: 'translate(-50%, -50%)' }
}

export function TimeLabelsStrip() {
  return (
    <div style={containerStyle} aria-hidden>
      {LABELS.map((l, i) => (
        <span key={i} style={labelStyle(l.pct, l.anchor)}>{l.text}</span>
      ))}
    </div>
  )
}
