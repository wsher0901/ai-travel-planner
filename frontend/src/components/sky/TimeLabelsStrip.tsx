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

function labelStyle(pct: number, anchor: 'start' | 'center' | 'end'): CSSProperties {
  const tx = anchor === 'start' ? '0' : anchor === 'end' ? '-100%' : '-50%'
  return {
    position: 'absolute',
    left: `${pct}%`,
    top: '50%',
    transform: `translate(${tx}, -50%)`,
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    letterSpacing: '0.02em',
  }
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
