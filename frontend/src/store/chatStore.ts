import { create } from 'zustand'

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
}

export interface Sliders {
  budget: number
  flexibility: number
  inter_distance: number
  intra_distance: number
  adventure_level: number
}

export type SliderKey = keyof Sliders

interface ChatState {
  messages: Message[]
  zeroShotActive: boolean
  isLoading: boolean
  sessionId: string | null
  sliders: Sliders

  addMessage: (role: MessageRole, content: string) => void
  updateMessage: (id: string, content: string) => void
  setZeroShotActive: (active: boolean) => void
  setLoading: (loading: boolean) => void
  setSessionId: (id: string | null) => void
  setSlider: (key: SliderKey, value: number) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  zeroShotActive: false,
  isLoading: false,
  sessionId: null,

  addMessage: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role,
          content,
          timestamp: new Date(),
        },
      ],
    })),

  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content } : msg
      ),
    })),

  sliders: {
    budget: 50,
    flexibility: 50,
    inter_distance: 50,
    intra_distance: 50,
    adventure_level: 50,
  },

  setZeroShotActive: (zeroShotActive) => set({ zeroShotActive }),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionId: (sessionId) => set({ sessionId }),
  setSlider: (key, value) =>
    set((state) => ({
      sliders: { ...state.sliders, [key]: value },
    })),
  clearMessages: () => set({ messages: [] }),
}))
