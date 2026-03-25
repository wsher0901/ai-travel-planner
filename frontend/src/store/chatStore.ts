import { create } from 'zustand'

export type MessageRole = 'user' | 'assistant'
export type ChatMode = 'zero-shot' | 'plan' | 'ask'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
}

interface ChatState {
  messages: Message[]
  mode: ChatMode
  isLoading: boolean
  sessionId: string | null

  addMessage: (role: MessageRole, content: string) => void
  updateMessage: (id: string, content: string) => void
  setMode: (mode: ChatMode) => void
  setLoading: (loading: boolean) => void
  setSessionId: (id: string | null) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  mode: 'plan',
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

  setMode: (mode) => set({ mode }),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionId: (sessionId) => set({ sessionId }),
  clearMessages: () => set({ messages: [] }),
}))
