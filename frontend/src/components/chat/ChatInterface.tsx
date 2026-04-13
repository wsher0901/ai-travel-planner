'use client'

import React, { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Compass, SlidersHorizontal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import SliderPanel from './SliderPanel'
import { useChatStore, type ChatMode } from '@/store/chatStore'
import { useTripStore } from '@/store/tripStore'
import { useUIStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase'

// ── Mode config ────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<ChatMode, { label: string; description: string; placeholder: string; emptyHeading: string; emptyHint: string }> = {
  'zero-shot': {
    label: 'Zero-Shot',
    description: 'Get a full plan instantly',
    placeholder: "When are you free? Where are you flying from?",
    emptyHeading: 'Zero-Shot Mode',
    emptyHint: "Tell me your dates, budget, and vibe — I'll handle the rest.",
  },
  plan: {
    label: 'Plan',
    description: 'Build your trip together',
    placeholder: "Let's build your trip together...",
    emptyHeading: 'Plan Mode',
    emptyHint: "Let's build your perfect trip step by step.",
  },
  ask: {
    label: 'Ask',
    description: 'Ask anything about destinations',
    placeholder: 'Ask me anything about any destination...',
    emptyHeading: 'Ask Mode',
    emptyHint: 'Ask me anything — weather, costs, visas, hidden gems.',
  },
}

// ── Mode colors ────────────────────────────────────────────────────────────
const MODE_COLORS: Record<ChatMode, { color: string; glow: string; headlineColor: string; chipBorder: string }> = {
  'zero-shot': { color: '#f59e0b', glow: 'radial-gradient(ellipse at 50% 60%, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.03) 40%, transparent 70%)', headlineColor: '#fbbf24', chipBorder: 'rgba(245,158,11,0.35)' },
  plan:        { color: '#3b82f6', glow: 'radial-gradient(ellipse at 50% 60%, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.03) 40%, transparent 70%)',  headlineColor: '#60a5fa', chipBorder: 'rgba(59,130,246,0.35)' },
  ask:         { color: '#10b981', glow: 'radial-gradient(ellipse at 50% 60%, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.03) 40%, transparent 70%)', headlineColor: '#34d399', chipBorder: 'rgba(16,185,129,0.35)' },
}

const MODES_ORDER: ChatMode[] = ['zero-shot', 'plan', 'ask']

// ── Mode selector ──────────────────────────────────────────────────────────
const MODE_DESCRIPTIONS: Record<ChatMode, string> = {
  'zero-shot': 'Get a complete trip plan instantly',
  plan: 'Build your trip conversationally',
  ask: 'Ask anything about destinations',
}

function ModeSelector({ onSelect }: { onSelect: (newMode: ChatMode) => void }) {
  const mode = useChatStore((s) => s.mode)
  const modes = Object.keys(MODE_CONFIG) as ChatMode[]

  return (
    <div className="shrink-0" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '3px',
            gap: '2px',
            position: 'relative',
          }}
        >
          {modes.map((key) => {
            const active = mode === key
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  padding: '5px 18px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sora)',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: active ? MODE_COLORS[key].color : 'rgba(255,255,255,0.35)',
                  transition: 'color 0.2s',
                }}
              >
                {active && (
                  <motion.div
                    layoutId="segment-bg"
                    layout
                    animate={{ backgroundColor: `${MODE_COLORS[mode].color}18` }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 0,
                      borderRadius: '7px',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>
                  {MODE_CONFIG[key].label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.25)',
          fontFamily: 'var(--font-sora)',
          textAlign: 'center',
          margin: '0 0 4px 0',
        }}
      >
        {MODE_DESCRIPTIONS[mode]}
      </p>
    </div>
  )
}

// ── Streaming dots ─────────────────────────────────────────────────────────
function StreamingDots({ modeColor }: { modeColor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '48px', height: '4px', borderRadius: '2px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          style={{ height: '100%', width: '50%', borderRadius: '2px', background: modeColor, opacity: 0.6 }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span style={{ fontSize: '12px', color: modeColor, opacity: 0.5, fontFamily: 'var(--font-sora)', fontStyle: 'italic' }}>
        thinking
      </span>
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────
function PostPlanCTA() {
  const setLayoutMode = useUIStore((s) => s.setLayoutMode)
  const setMode = useChatStore((s) => s.setMode)
  const clearMessages = useChatStore((s) => s.clearMessages)
  const setSessionId = useChatStore((s) => s.setSessionId)

  const btnBase: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '9999px',
    fontFamily: 'var(--font-sora)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
      <button
        onClick={() => setLayoutMode('split')}
        style={{
          ...btnBase,
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          color: '#fbbf24',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.25)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.15)' }}
      >
        Open Visual Planner ✨
      </button>
      <button
        onClick={() => {
          setMode('zero-shot')
          clearMessages()
          setSessionId(null)
          useTripStore.getState().clearTrip()
        }}
        style={{
          ...btnBase,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.5)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.border = '1px solid rgba(255,255,255,0.25)'
          el.style.color = 'rgba(255,255,255,0.7)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement
          el.style.border = '1px solid rgba(255,255,255,0.12)'
          el.style.color = 'rgba(255,255,255,0.5)'
        }}
      >
        Start a New Plan
      </button>
    </div>
  )
}

function MessageBubble({ role, content, modeColor, isTyping, timestamp }: { role: 'user' | 'assistant'; content: string; modeColor: string; isTyping?: boolean; timestamp: Date }) {
  const isUser = role === 'user'
  const timeStr = timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const CTA_MARKER = '[CTA:POST_PLAN]'
  const hasCTA = !isUser && content.includes(CTA_MARKER)
  const textContent = hasCTA ? content.replace(CTA_MARKER, '').trimEnd() : content

  return (
    <motion.div
      initial={isUser ? { opacity: 0, y: 8, scale: 0.97, filter: 'blur(2px)' } : { opacity: 0, y: 10 }}
      animate={isUser ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : { opacity: 1, y: 0 }}
      transition={isUser ? { duration: 0.2, ease: [0.2, 0, 0, 1] } : { duration: 0.25 }}
      className="group"
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: isUser ? '70%' : '80%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: modeColor,
            marginTop: '7px',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={isUser ? {
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '18px 18px 4px 18px',
            padding: '12px 16px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'var(--font-sora)',
          } : {
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'var(--font-sora)',
            lineHeight: '1.7',
          }}
        >
          {isUser ? content : (
            <>
              <ReactMarkdown
                components={{
                  strong: ({ children }) => <strong style={{ color: 'white', fontWeight: 600 }}>{children}</strong>,
                  p: ({ children }) => <p style={{ marginBottom: '8px' }}>{children}</p>,
                  ol: ({ children }) => <ol style={{ paddingLeft: '20px', marginBottom: '8px' }}>{children}</ol>,
                  ul: ({ children }) => <ul style={{ paddingLeft: '20px', marginBottom: '8px' }}>{children}</ul>,
                  li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                }}
              >
                {textContent}
              </ReactMarkdown>
              {hasCTA && <PostPlanCTA />}
              {isTyping && (
                <motion.span
                  style={{ color: modeColor, fontWeight: 300, marginLeft: '1px' }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                >|</motion.span>
              )}
            </>
          )}
        </div>
        <span
          className="opacity-0 group-hover:opacity-100"
          style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.2)',
            fontFamily: 'var(--font-sora)',
            marginTop: '4px',
            textAlign: isUser ? 'right' : 'left',
            transition: 'opacity 0.2s',
          }}
        >
          {timeStr}
        </span>
      </div>
    </motion.div>
  )
}

// ── Input pill ─────────────────────────────────────────────────────────────
function InputPill({
  slidersOpen,
  onToggleSliders,
  input,
  onInputChange,
  onKeyDown,
  onSend,
  canSend,
  mode,
  textareaRef,
  onFocus,
  onBlur,
  isFocused,
  hasText,
  hasStarted,
}: {
  slidersOpen: boolean
  onToggleSliders: () => void
  input: string
  onInputChange: (value: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  canSend: boolean
  mode: ChatMode
  textareaRef: React.RefObject<HTMLTextAreaElement>
  onFocus: () => void
  onBlur: () => void
  isFocused: boolean
  hasText: boolean
  hasStarted: boolean
}) {
  const [sliderBtnHovered, setSliderBtnHovered] = useState(false)

  const borderColor = isFocused && hasText
    ? `${MODE_COLORS[mode].color}40`
    : isFocused
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(255,255,255,0.1)'
  const boxShadow = isFocused && hasText
    ? `0 0 12px ${MODE_COLORS[mode].color}15`
    : 'none'

  return (
    <motion.div
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${borderColor}`,
        borderRadius: '20px',
        padding: '8px 8px 8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <button
        onClick={onToggleSliders}
        onMouseEnter={() => setSliderBtnHovered(true)}
        onMouseLeave={() => setSliderBtnHovered(false)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
          border: 'none',
          cursor: 'pointer',
          background: sliderBtnHovered
            ? 'rgba(255,255,255,0.08)'
            : slidersOpen
            ? 'rgba(255,255,255,0.1)'
            : 'transparent',
          color: slidersOpen ? 'white' : 'rgba(255,255,255,0.35)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <SlidersHorizontal size={18} />
      </button>

      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={hasStarted ? 'Message Roam...' : MODE_CONFIG[mode].placeholder}
        rows={1}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'white',
          fontFamily: 'var(--font-sora)',
          fontSize: '15px',
          resize: 'none',
          minHeight: '36px',
          maxHeight: '200px',
          padding: '6px 0',
          lineHeight: '1.5',
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
        className="placeholder-[rgba(255,255,255,0.25)] [&::-webkit-scrollbar]:hidden"
      />

      <motion.button
        onClick={onSend}
        disabled={!canSend}
        whileTap={canSend ? { scale: 0.9 } : {}}
        whileHover={canSend ? { opacity: 0.85 } : {}}
        style={{
          flexShrink: 0,
          width: '36px',
          height: '36px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: MODE_COLORS[mode].color,
          border: 'none',
          cursor: canSend ? 'pointer' : 'default',
          opacity: canSend ? 1 : 0.3,
          transition: 'opacity 0.2s',
        }}
      >
        <ArrowUp size={18} color="#080808" />
      </motion.button>
    </motion.div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
const EMPTY_STATE_CONTENT: Record<ChatMode, { headline: string; subtext: string; chips: string[] }> = {
  'zero-shot': {
    headline: 'When are you free?',
    subtext: "Tell me your dates and home city — I'll build a full trip plan instantly.",
    chips: ['Free in late April', 'Flying from NYC', 'Budget around $2000'],
  },
  plan: {
    headline: "Let's build your trip.",
    subtext: "We'll figure out the destination, pace, and details together — one step at a time.",
    chips: ['I have 10 days in June', 'I want beaches and food', 'Flexible on destination'],
  },
  ask: {
    headline: 'What do you want to know?',
    subtext: 'Ask me anything — visa rules, best seasons, hidden gems, local tips.',
    chips: ['Is Japan safe solo?', 'Best time for Patagonia', 'Cheapest cities in Europe'],
  },
}

function ChipButton({ label, onClick, chipBorder }: { label: string; onClick: () => void; chipBorder: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        border: `1px solid ${hovered ? chipBorder : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '9999px',
        padding: '8px 16px',
        fontSize: '13px',
        color: hovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.55)',
        fontFamily: 'var(--font-sora)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
        background: 'rgba(255,255,255,0.05)',
      }}
    >
      {label}
    </button>
  )
}

const PARTICLES = [
  { x: '12%',  y: '18%', duration: 6.2, delay: 0 },
  { x: '78%',  y: '32%', duration: 4.8, delay: 1.1 },
  { x: '55%',  y: '72%', duration: 7.0, delay: 0.6 },
  { x: '28%',  y: '61%', duration: 5.4, delay: 2.3 },
  { x: '88%',  y: '80%', duration: 6.6, delay: 1.7 },
]

function EmptyState({
  mode,
  onChipClick,
  modeColor,
  headlineColor,
  chipBorder,
  hasStarted,
  children,
}: {
  mode: ChatMode
  onChipClick: (text: string) => void
  modeColor: string
  headlineColor: string
  chipBorder: string
  hasStarted: boolean
  children?: React.ReactNode
}) {
  const content = EMPTY_STATE_CONTENT[mode]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        position: 'relative',
        gap: '16px',
        padding: '0 24px',
      }}
    >
      {/* Ambient particles */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.div
            key="particles"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
          >
            {PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: p.y,
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  background: modeColor,
                  opacity: 0.1,
                }}
                animate={{ y: [0, -18, 0], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Headline, subtext, chips */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.div
            key="content"
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'absolute', top: '40%', transform: 'translateY(-50%)', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
          >
            <Compass
              size={28}
              color={modeColor}
              style={{ filter: `drop-shadow(0 0 12px ${modeColor}66)` }}
            />
            <p
              style={{
                fontFamily: 'var(--font-sora)',
                fontSize: '42px',
                fontWeight: 700,
                color: headlineColor,
                textAlign: 'center',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {content.headline}
            </p>
            <p
              style={{
                fontSize: '16px',
                color: 'rgba(255,255,255,0.32)',
                fontFamily: 'var(--font-sora)',
                textAlign: 'center',
                maxWidth: '420px',
              }}
            >
              {content.subtext}
            </p>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: '8px',
              }}
            >
              {content.chips.map((chip) => (
                <ChipButton key={chip} label={chip} onClick={() => onChipClick(chip)} chipBorder={chipBorder} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input pill injected from parent when !hasStarted */}
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ChatInterface() {
  const messages = useChatStore((s) => s.messages)
  const mode = useChatStore((s) => s.mode)
  const isLoading = useChatStore((s) => s.isLoading)
  const sessionId = useChatStore((s) => s.sessionId)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const setMode = useChatStore((s) => s.setMode)
  const setLoading = useChatStore((s) => s.setLoading)
  const setSessionId = useChatStore((s) => s.setSessionId)
  const sliders = useChatStore((s) => s.sliders)

  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [slidersOpen, setSlidersOpen] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [slideDirection, setSlideDirection] = useState(0)
  const prevModeIndexRef = useRef<number>(MODES_ORDER.indexOf(mode))
  const [inputFocused, setInputFocused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [input])

  const handleModeSelect = useCallback((newMode: ChatMode) => {
    const newIdx = MODES_ORDER.indexOf(newMode)
    const dir = newIdx > prevModeIndexRef.current ? 1 : -1
    setSlideDirection(dir)
    prevModeIndexRef.current = newIdx
    setMode(newMode)
  }, [setMode])

  // Helper: add a placeholder assistant bubble and return its id
  const addPlaceholder = useCallback(() => {
    const id = crypto.randomUUID()
    useChatStore.getState().messages.push({
      id,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    })
    useChatStore.setState({ messages: [...useChatStore.getState().messages] })
    setStreamingId(id)
    return id
  }, [])

  // Zero-shot mode: single request to /plan/generate
  const handleZeroShot = useCallback(async (trimmed: string) => {
    const assistantId = addPlaceholder()

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          session_id: null,
          user_id: user?.id ?? null,
          sliders,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()

      const summary = [
        `✈ ${data.destination}`,
        `${data.start_date} → ${data.end_date}`,
        '',
        data.summary,
      ].join('\n')

      const words = summary.split(' ')
      let accumulated = ''
      for (const word of words) {
        accumulated += (accumulated ? ' ' : '') + word
        updateMessage(assistantId, accumulated)
        await new Promise(r => setTimeout(r, 25))
      }

      setSessionId(data.trip_plan_id)
      setMode('plan')

      useTripStore.getState().setTripPlan({
        id: data.trip_plan_id,
        destination: data.destination,
        origin_city: data.origin_city || null,
        start_date: data.start_date,
        end_date: data.end_date,
        budget_range: data.budget_range || '',
        destination_timezone: data.destination_timezone || null,
        destination_latitude: data.destination_latitude || null,
        destination_longitude: data.destination_longitude || null,
        number_of_travelers: data.number_of_travelers || 1,
        user_timezone: data.user_timezone || null,
      })
      useTripStore.getState().setPlanItems(data.items || [])

      await new Promise(r => setTimeout(r, 1500))
      const ctaText = "Your trip plan is ready! Want me to open the visual planner? You'll get an interactive timeline, map, weather forecasts, and budget breakdown.\n\n[CTA:POST_PLAN]"
      const ctaId = crypto.randomUUID()
      useChatStore.getState().messages.push({ id: ctaId, role: 'assistant', content: '', timestamp: new Date() })
      useChatStore.setState({ messages: [...useChatStore.getState().messages] })
      const ctaWords = ctaText.split(' ')
      let ctaAccumulated = ''
      for (const word of ctaWords) {
        ctaAccumulated += (ctaAccumulated ? ' ' : '') + word
        useChatStore.setState((s) => ({
          messages: s.messages.map((m) => m.id === ctaId ? { ...m, content: ctaAccumulated } : m),
        }))
        await new Promise(r => setTimeout(r, 25))
      }
    } catch {
      updateMessage(assistantId, 'Something went wrong. Please try again.')
    } finally {
      setStreamingId(null)
      setLoading(false)
    }
  }, [sessionId, sliders, addPlaceholder, updateMessage, setSessionId, setLoading])

  // Plan / Ask modes: SSE stream to /chat/stream
  const handleStream = useCallback(async (trimmed: string) => {
    const assistantId = addPlaceholder()

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, mode, session_id: sessionId, sliders }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let accumulated = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            accumulated += line.slice(6)
            updateMessage(assistantId, accumulated)
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith('data: ')) {
        accumulated += buffer.slice(6)
        updateMessage(assistantId, accumulated)
      }

      if (!accumulated) {
        updateMessage(assistantId, 'No response received. Please try again.')
      }
    } catch {
      updateMessage(assistantId, 'Something went wrong. Please try again.')
    } finally {
      setStreamingId(null)
      setLoading(false)
    }
  }, [mode, sessionId, sliders, addPlaceholder, updateMessage, setLoading])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setHasStarted(true)
    addMessage('user', trimmed)
    setInput('')
    setLoading(true)

    if (mode === 'zero-shot') {
      handleZeroShot(trimmed)
    } else {
      handleStream(trimmed)
    }
  }, [input, isLoading, mode, addMessage, setLoading, handleZeroShot, handleStream])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = input.trim().length > 0 && !isLoading

  const pillProps = {
    slidersOpen,
    onToggleSliders: () => setSlidersOpen((o) => !o),
    input,
    onInputChange: setInput,
    onKeyDown: handleKeyDown,
    onSend: handleSend,
    canSend,
    mode,
    textareaRef,
    onFocus: () => setInputFocused(true),
    onBlur: () => setInputFocused(false),
    isFocused: inputFocused,
    hasText: input.trim().length > 0,
    hasStarted,
  }

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', position: 'relative', background: '#080808', overflow: 'hidden' }}>
      {/* Background glow */}
      <motion.div
        animate={{ background: MODE_COLORS[mode].glow }}
        transition={{ duration: 0.5 }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      />
      {/* Mode selector */}
      <ModeSelector onSelect={handleModeSelect} />

      {/* Message thread */}
      <div style={{ flex: 1, overflow: 'hidden', zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={mode}
            custom={slideDirection}
            variants={{
              enter: (dir: number) => ({ opacity: 0, x: dir * 60 }),
              center: { opacity: 1, x: 0 },
              exit: (dir: number) => ({ opacity: 0, x: dir * -60 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}
          >
            {messages.length === 0 ? (
              <EmptyState
                mode={mode}
                onChipClick={setInput}
                modeColor={MODE_COLORS[mode].color}
                headlineColor={MODE_COLORS[mode].headlineColor}
                chipBorder={MODE_COLORS[mode].chipBorder}
                hasStarted={hasStarted}
              >
                {!hasStarted && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '62%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '100%',
                      maxWidth: '720px',
                      padding: '0 24px',
                    }}
                  >
                    <InputPill {...pillProps} />
                    <AnimatePresence>
                      {slidersOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          style={{ overflow: 'hidden', paddingTop: '12px' }}
                        >
                          <SliderPanel />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </EmptyState>
            ) : (
              <div
                className="[&::-webkit-scrollbar]:hidden"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                  padding: '24px 24px 160px',
                  maxWidth: '720px',
                  margin: '0 auto',
                  width: '100%',
                  flex: 1,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    modeColor={MODE_COLORS[mode].color}
                    isTyping={msg.id === streamingId}
                    timestamp={msg.timestamp}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            {/* Fixed input bar — only when hasStarted */}
            {hasStarted && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '24px 24px 32px',
                  background: 'linear-gradient(to top, #080808 70%, transparent)',
                  zIndex: 10,
                }}
              >
                <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                  <AnimatePresence>
                    {slidersOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden', paddingBottom: '12px' }}
                      >
                        <SliderPanel />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <InputPill {...pillProps} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
