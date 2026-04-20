import { create } from 'zustand'

interface UIState {
  layoutMode: 'discovery' | 'split'
  activeTab: 'itinerary' | 'map' | 'weather' | 'budget' | 'score'
  isTransitioning: boolean
  selectedDate: string | null
  hoveredActivityId: string | null
  expandedActivityId: string | null
  focusMode: boolean
  setLayoutMode: (mode: 'discovery' | 'split') => void
  setActiveTab: (tab: UIState['activeTab']) => void
  setIsTransitioning: (v: boolean) => void
  setSelectedDate: (date: string | null) => void
  setHoveredActivityId: (id: string | null) => void
  setExpandedActivityId: (id: string | null) => void
  toggleExpandedActivityId: (id: string) => void
  setFocusMode: (focus: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  layoutMode: 'discovery',
  activeTab: 'itinerary',
  isTransitioning: false,
  selectedDate: null,
  hoveredActivityId: null,
  expandedActivityId: null,
  focusMode: false,
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setHoveredActivityId: (hoveredActivityId) => set({ hoveredActivityId }),
  setExpandedActivityId: (expandedActivityId) => set({ expandedActivityId }),
  toggleExpandedActivityId: (id) => set((s) => ({
    expandedActivityId: s.expandedActivityId === id ? null : id,
  })),
  setFocusMode: (focusMode) => set({ focusMode }),
}))
