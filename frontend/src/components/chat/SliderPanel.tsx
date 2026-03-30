'use client'

import { Slider } from 'radix-ui'
import { useChatStore, type SliderKey } from '@/store/chatStore'

const SLIDER_CONFIG: { key: SliderKey; label: string; labels: [string, string, string] }[] = [
  { key: 'budget', label: 'Budget', labels: ['Budget', 'Mid-range', 'Luxury'] },
  { key: 'flexibility', label: 'Pace', labels: ['Relaxed', 'Moderate', 'Packed'] },
  { key: 'inter_distance', label: 'Distance', labels: ['Nearby', 'Regional', 'Anywhere'] },
  { key: 'intra_distance', label: 'Activity', labels: ['Easy', 'Moderate', 'Active'] },
  { key: 'adventure_level', label: 'Vibe', labels: ['Cultural', 'Mixed', 'Adventure'] },
]

function valueLabel(value: number, labels: [string, string, string]) {
  if (value <= 33) return labels[0]
  if (value <= 66) return labels[1]
  return labels[2]
}

export default function SliderPanel() {
  const sliders = useChatStore((s) => s.sliders)
  const setSlider = useChatStore((s) => s.setSlider)

  return (
    <div
      className="rounded-xl border p-3.5 px-4"
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {SLIDER_CONFIG.map(({ key, label, labels }, i) => (
        <div
          key={key}
          className="flex items-center gap-3"
          style={{ marginBottom: i < SLIDER_CONFIG.length - 1 ? 10 : 0 }}
        >
          <span className="w-16 shrink-0 font-[family-name:var(--font-sora)] text-[12px] text-[rgba(255,255,255,0.45)]">
            {label}
          </span>

          <Slider.Root
            className="relative flex h-4 flex-1 touch-none items-center select-none"
            value={[sliders[key]]}
            onValueChange={([v]) => setSlider(key, v)}
            max={100}
            step={1}
          >
            <Slider.Track className="relative h-1 flex-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Slider.Range className="absolute h-full rounded-full bg-amber-500" />
            </Slider.Track>
            <Slider.Thumb className="block h-3.5 w-3.5 cursor-pointer rounded-full bg-white shadow focus:outline-none" />
          </Slider.Root>

          <span className="w-16 shrink-0 text-right font-[family-name:var(--font-sora)] text-[11px] text-[rgba(255,255,255,0.45)]">
            {valueLabel(sliders[key], labels)}
          </span>
        </div>
      ))}
    </div>
  )
}
