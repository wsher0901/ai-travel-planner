import { create } from 'zustand'

interface UIState {
  layoutMode: 'discovery' | 'split'
  activeTab: 'timeline' | 'map' | 'weather' | 'budget'
  isTransitioning: boolean
  setLayoutMode: (mode: 'discovery' | 'split') => void
  setActiveTab: (tab: UIState['activeTab']) => void
  setIsTransitioning: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  layoutMode: 'discovery',
  activeTab: 'timeline',
  isTransitioning: false,
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
}))
