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

// ── Mode selector ──────────────────────────────────────────────────────────
function ModeSelector() {
  const mode = useChatStore((s) => s.mode)
  const setMode = useChatStore((s) => s.setMode)

  return (
    <div className="flex shrink-0 justify-center gap-2 px-4 pt-6 pb-4">
      {(Object.keys(MODE_CONFIG) as ChatMode[]).map((key) => {
        const active = mode === key
        return (
          <button
            key={key}
            onClick={() => setMode(key)}
            className="flex flex-col items-center rounded-full border px-5 py-2 transition-colors"
            style={{
              backgroundColor: active ? 'rgba(245,158,11,0.15)' : 'transparent',
              borderColor: active ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)',
              color: active ? 'rgb(245,158,11)' : 'rgba(255,255,255,0.35)',
            }}
          >
            <span className="font-[family-name:var(--font-sora)] text-sm font-medium">
              {MODE_CONFIG[key].label}
            </span>
            <span className="mt-0.5 text-[10px] opacity-70">
              {MODE_CONFIG[key].description}
            </span>
          </button>
        )
      })}
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
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}>
          <Compass size={13} color="rgb(245,158,11)" />
        </div>
      )}
      <div
        className="max-w-[75%] rounded-2xl px-4 py-2.5 font-[family-name:var(--font-sora)] text-sm leading-relaxed"
        style={{
          backgroundColor: isUser ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
          color: isUser ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)',
        }}
      >
        {isTyping ? <TypingIndicator /> : content}
      </div>
    </motion.div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ mode }: { mode: ChatMode }) {
  const config = MODE_CONFIG[mode]
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
        <Compass size={20} color="rgb(245,158,11)" />
      </div>
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-semibold text-white">
        {config.emptyHeading}
      </h2>
      <p className="text-sm text-[rgba(255,255,255,0.35)]">{config.emptyHint}</p>
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
  const setLoading = useChatStore((s) => s.setLoading)
  const setSessionId = useChatStore((s) => s.setSessionId)
  const sliders = useChatStore((s) => s.sliders)

  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [slidersOpen, setSlidersOpen] = useState(false)
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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Mode selector */}
      <ModeSelector />

      {/* Message thread */}
      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <EmptyState mode={mode} />
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
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
      </div>

      {/* Slider panel + Input bar */}
      <div className="shrink-0 px-4 pb-4">
        <div className="mx-auto max-w-2xl">
          <AnimatePresence>
            {slidersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden pb-2"
              >
                <SliderPanel />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="flex items-end gap-2 rounded-2xl border p-3"
            style={{
              backgroundColor: 'rgba(12,12,12,0.6)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <button
              onClick={() => setSlidersOpen((o) => !o)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
              style={{ backgroundColor: slidersOpen ? 'rgba(245,158,11,0.15)' : 'transparent' }}
            >
              <SlidersHorizontal
                size={16}
                color={slidersOpen ? 'rgb(245,158,11)' : 'rgba(255,255,255,0.35)'}
              />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={MODE_CONFIG[mode].placeholder}
              rows={1}
              className="flex-1 resize-none bg-transparent font-[family-name:var(--font-sora)] text-sm text-white placeholder-[rgba(255,255,255,0.25)] outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-25"
              style={{ backgroundColor: canSend ? 'rgba(245,158,11,0.2)' : 'transparent' }}
            >
              <Compass
                size={16}
                color="rgb(245,158,11)"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
