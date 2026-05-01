import { CSSProperties } from 'react'
import { hourToTimelinePercent } from '@/lib/timelineInset'

const LABELS = [
  { hour: 0,  text: '12 AM' },
  { hour: 3,  text: '3 AM'  },
  { hour: 6,  text: '6 AM'  },
  { hour: 9,  text: '9 AM'  },
  { hour: 12, text: 'NOON'  },
  { hour: 15, text: '3 PM'  },
  { hour: 18, text: '6 PM'  },
  { hour: 21, text: '9 PM'  },
  { hour: 24, text: '12 AM' },
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
  fontSize: '11px',
  fontWeight: 500,
  color: 'rgba(255, 255, 255, 0.9)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  letterSpacing: '0.02em',
  transform: 'translate(-50%, -50%)',
}

export function TimeLabelsStrip() {
  return (
    <div style={containerStyle} aria-hidden>
      {LABELS.map((l, i) => (
        <span key={i} style={{ ...baseLabel, left: `${hourToTimelinePercent(l.hour)}%` }}>
          {l.text}
        </span>
      ))}
    </div>
  )
}
