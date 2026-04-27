'use client'

import { Slider } from 'radix-ui'
import { useChatStore, type SliderKey } from '@/store/chatStore'

const SLIDER_CONFIG: { key: SliderKey; label: string; labels: [string, string, string, string, string] }[] = [
  { key: 'budget',         label: 'Budget',   labels: ['Under $50/day', '$50–100/day', '$100–200/day', '$200–400/day', '$400+/day'] },
  { key: 'flexibility',    label: 'Pace',     labels: ['Very relaxed', 'Leisurely', 'Moderate', 'Packed', 'Jam-packed'] },
  { key: 'inter_distance', label: 'Distance', labels: ['Stay local', 'Same region', 'Neighboring countries', 'Cross-continent', 'Anywhere'] },
  { key: 'intra_distance', label: 'Activity', labels: ['1–2 things/day', '2–3 things/day', '3–4 things/day', '4–5 things/day', '5+ things/day'] },
  { key: 'adventure_level',label: 'Vibe',     labels: ['Pure relaxation', 'Mostly chill', 'Mix of both', 'Mostly active', 'Full adventure'] },
]

const ACCENT_COLOR = '#f59e0b'

function valueLabel(value: number, labels: [string, string, string, string, string]) {
  return labels[Math.min(Math.max(Math.round(value), 0), 4)]
}

export default function SliderPanel() {
  const sliders = useChatStore((s) => s.sliders)
  const setSlider = useChatStore((s) => s.setSlider)

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        padding: '20px 24px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {SLIDER_CONFIG.map(({ key, label, labels }, i) => {
        // Map store value (0–100) to slider display value (0–4)
        const displayValue = Math.round((sliders[key] / 100) * 4)
        const currentLabel = valueLabel(displayValue, labels)
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: i < SLIDER_CONFIG.length - 1 ? '16px' : 0,
            }}
          >
            <span
              style={{
                width: '72px',
                flexShrink: 0,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.45)',
                fontFamily: 'var(--font-sora)',
              }}
            >
              {label}
            </span>

            <Slider.Root
              aria-label={label}
              style={{ position: 'relative', display: 'flex', flex: 1, alignItems: 'center', touchAction: 'none', userSelect: 'none', height: '20px' }}
              value={[displayValue]}
              onValueChange={([v]) => setSlider(key, Math.round((v / 4) * 100))}
              min={0}
              max={4}
              step={1}
            >
              <Slider.Track
                style={{
                  position: 'relative',
                  flex: 1,
                  height: '3px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                <Slider.Range
                  style={{
                    position: 'absolute',
                    height: '100%',
                    borderRadius: '2px',
                    backgroundColor: ACCENT_COLOR,
                  }}
                />
              </Slider.Track>
              <Slider.Thumb
                aria-valuetext={currentLabel}
                style={{
                  display: 'block',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: 'white',
                  border: `2px solid ${ACCENT_COLOR}`,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: 'none',
                  WebkitAppearance: 'none',
                }}
              />
            </Slider.Root>

            <span
              style={{
                minWidth: '120px',
                fontSize: '12px',
                color: ACCENT_COLOR,
                fontFamily: 'var(--font-sora)',
                textAlign: 'right',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {currentLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}
