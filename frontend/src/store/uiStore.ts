import { create } from 'zustand'

interface UIState {
  layoutMode: 'discovery' | 'split'
  activeTab: 'itinerary' | 'map' | 'weather' | 'budget' | 'score'
  isTransitioning: boolean
  selectedDate: string | null
  dateChangeDirection: 1 | -1 | 0
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
  dateChangeDirection: 0,
  hoveredActivityId: null,
  expandedActivityId: null,
  focusMode: false,
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
  setSelectedDate: (selectedDate) => set((s) => {
    let dateChangeDirection: 1 | -1 | 0 = 0;
    if (s.selectedDate && selectedDate && s.selectedDate !== selectedDate) {
      dateChangeDirection = selectedDate > s.selectedDate ? 1 : -1;
    }
    return { selectedDate, dateChangeDirection };
  }),
  setHoveredActivityId: (hoveredActivityId) => set({ hoveredActivityId }),
  setExpandedActivityId: (expandedActivityId) => set({ expandedActivityId }),
  toggleExpandedActivityId: (id) => set((s) => ({
    expandedActivityId: s.expandedActivityId === id ? null : id,
  })),
  setFocusMode: (focusMode) => set({ focusMode }),
}))
