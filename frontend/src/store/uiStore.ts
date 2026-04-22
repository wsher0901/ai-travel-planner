import { create } from 'zustand'

interface UIState {
  layoutMode: 'discovery' | 'split'
  activeTab: 'itinerary' | 'map' | 'weather' | 'budget' | 'score'
  isTransitioning: boolean
  selectedDate: string | null
  dateChangeDirection: 1 | -1 | 0
  hoveredActivityId: string | null
  expandedActivityIds: Set<string>
  focusMode: boolean
  setLayoutMode: (mode: 'discovery' | 'split') => void
  setActiveTab: (tab: UIState['activeTab']) => void
  setIsTransitioning: (v: boolean) => void
  setSelectedDate: (date: string | null) => void
  setHoveredActivityId: (id: string | null) => void
  toggleExpandedActivityId: (id: string) => void
  clearExpandedActivityIds: () => void
  setFocusMode: (focus: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  layoutMode: 'discovery',
  activeTab: 'itinerary',
  isTransitioning: false,
  selectedDate: null,
  dateChangeDirection: 0,
  hoveredActivityId: null,
  expandedActivityIds: new Set<string>(),
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
  toggleExpandedActivityId: (id) => set((s) => {
    const next = new Set(s.expandedActivityIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { expandedActivityIds: next };
  }),
  clearExpandedActivityIds: () => set({ expandedActivityIds: new Set<string>() }),
  setFocusMode: (focusMode) => set({ focusMode }),
}))
