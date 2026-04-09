'use client'

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, SlidersHorizontal } from 'lucide-react'
import SliderPanel from './SliderPanel'
import { useChatStore, type ChatMode } from '@/store/chatStore'
import { createClient } from '@/lib/supabase'

// ── Mode config ────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<ChatMode, { label: string; description: string; placeholder: string; emptyHeading: string; emptyHint: string }> = {
  'zero-shot': {
    label: 'Zero-Shot',
    description: 'Get a full plan instantly',
    placeholder: "Tell me when you're free and I'll plan everything...",
    emptyHeading: 'Zero-Shot Mode',
    emptyHint: "Tell me your dates, budget, and vibe — I'll handle the rest.",
  },
  plan: {
    label: 'Plan',
    description: 'Build your trip together',
    placeholder: 'Where are you thinking of going?',
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

// ── Swipe variants ─────────────────────────────────────────────────────────
const swipeVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 120, scale: 0.97 }),
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -120, scale: 0.97 }),
}

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

// ── Typing indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({ role, content, isTyping }: { role: 'user' | 'assistant'; content: string; isTyping?: boolean }) {
  const isUser = role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="mr-3 mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center">
          <Compass size={12} strokeWidth={1.5} color="rgba(245,158,11,0.7)" />
        </div>
      )}
      {isUser ? (
        <div
          className="max-w-[70%] px-4 py-2.5 font-[family-name:var(--font-sora)] text-sm leading-relaxed"
          style={{
            backgroundColor: 'rgba(245,158,11,0.07)',
            color: 'rgba(255,255,255,0.85)',
            borderRadius: '14px 14px 3px 14px',
            border: '1px solid rgba(245,158,11,0.11)',
          }}
        >
          {content}
        </div>
      ) : (
        <div
          className="max-w-[75%] border-l-2 py-0.5 pl-3.5 font-[family-name:var(--font-sora)] text-sm leading-relaxed"
          style={{
            borderColor: 'rgba(245,158,11,0.3)',
            color: 'rgba(255,255,255,0.68)',
          }}
        >
          {isTyping ? <TypingIndicator /> : content}
        </div>
      )}
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

function EmptyState({ mode, onChipClick, modeColor, headlineColor, chipBorder }: { mode: ChatMode; onChipClick: (text: string) => void; modeColor: string; headlineColor: string; chipBorder: string }) {
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
  const directionRef = useRef(1)
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
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px` // max ~4 lines
  }, [input])

  const handleModeSelect = useCallback((newMode: ChatMode) => {
    const MODES = ['zero-shot', 'plan', 'ask']
    directionRef.current = MODES.indexOf(newMode) > MODES.indexOf(mode) ? 1 : -1
    setMode(newMode)
  }, [mode, setMode])

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
          session_id: sessionId,
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

      updateMessage(assistantId, summary)
      setSessionId(data.trip_plan_id)
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
      <div className="flex flex-col px-6 py-6" style={{ flex: 1, overflow: 'hidden', zIndex: 1, position: 'relative' }}>
        <AnimatePresence mode="wait" custom={directionRef.current}>
          <motion.div
            key={mode}
            custom={directionRef.current}
            variants={swipeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
          >
            {messages.length === 0 ? (
              <EmptyState mode={mode} onChipClick={setInput} modeColor={MODE_COLORS[mode].color} headlineColor={MODE_COLORS[mode].headlineColor} chipBorder={MODE_COLORS[mode].chipBorder} />
            ) : (
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    isTyping={msg.id === streamingId && msg.content === ''}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slider panel + Input bar */}
      <div className="shrink-0 px-6" style={{ position: 'relative', zIndex: 1, paddingBottom: '24px', paddingTop: '12px' }}>
        <div className="mx-auto max-w-2xl">
          <AnimatePresence>
            {slidersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden pb-3"
              >
                <SliderPanel />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="flex items-end gap-3 rounded-xl border px-4 py-3"
            style={{
              backgroundColor: 'rgba(8,8,8,0.72)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderColor: inputFocused ? `${MODE_COLORS[mode].color}40` : 'rgba(255,255,255,0.07)',
              boxShadow: '0 0 0 1px rgba(245,158,11,0.04), 0 8px 32px rgba(0,0,0,0.45)',
              transition: 'border-color 0.2s',
            }}
          >
            <button
              onClick={() => setSlidersOpen((o) => !o)}
              className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all"
              style={{
                backgroundColor: slidersOpen ? 'rgba(245,158,11,0.1)' : 'transparent',
                border: `1px solid ${slidersOpen ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              <SlidersHorizontal
                size={13}
                color={slidersOpen ? 'rgb(245,158,11)' : 'rgba(255,255,255,0.28)'}
              />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={MODE_CONFIG[mode].placeholder}
              rows={1}
              className="flex-1 resize-none bg-transparent font-[family-name:var(--font-sora)] text-sm leading-relaxed text-white placeholder-[rgba(255,255,255,0.18)] outline-none"
            />

            <motion.button
              onClick={handleSend}
              disabled={!canSend}
              whileTap={canSend ? { scale: 0.88 } : {}}
              className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all"
              style={{
                backgroundColor: canSend ? 'rgba(245,158,11,0.15)' : 'transparent',
                border: `1px solid ${canSend ? 'rgba(245,158,11,0.28)' : 'rgba(255,255,255,0.07)'}`,
                opacity: canSend ? 1 : 0.28,
              }}
            >
              <Compass size={13} color="rgb(245,158,11)" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
