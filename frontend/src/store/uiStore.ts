import { create } from 'zustand'
import type { ScrollAreaHandle } from '@/components/ui/ScrollArea'

interface UIState {
  layoutMode: 'discovery' | 'split'
  activeTab: 'itinerary' | 'map' | 'weather' | 'budget' | 'score'
  isTransitioning: boolean
  selectedDate: string | null
  dateChangeDirection: 1 | -1 | 0
  hoverExpandedId: string | null
  lockedExpandedId: string | null
  suppressHoverUntilLeaveId: string | null
  itineraryScrollHandle: ScrollAreaHandle | null
  focusMode: boolean
  sidebarCollapsed: boolean
  setLayoutMode: (mode: 'discovery' | 'split') => void
  setActiveTab: (tab: UIState['activeTab']) => void
  setIsTransitioning: (v: boolean) => void
  /** selectedDate MUST be in YYYY-MM-DD ISO format (e.g. "2025-06-01"). */
  setSelectedDate: (date: string | null) => void
  setHoverExpandedId: (id: string | null) => void
  setLockedExpandedId: (id: string | null) => void
  setSuppressHoverUntilLeaveId: (id: string | null) => void
  setItineraryScrollHandle: (handle: ScrollAreaHandle | null) => void
  setFocusMode: (focus: boolean) => void
  resetDateChangeDirection: () => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  layoutMode: 'discovery',
  activeTab: 'itinerary',
  isTransitioning: false,
  selectedDate: null,
  dateChangeDirection: 0,
  hoverExpandedId: null,
  lockedExpandedId: null,
  suppressHoverUntilLeaveId: null,
  itineraryScrollHandle: null,
  focusMode: false,
  sidebarCollapsed: false,
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
  /** selectedDate MUST be in YYYY-MM-DD ISO format (e.g. "2025-06-01"). */
  setSelectedDate: (selectedDate) => set((s) => {
    let dateChangeDirection: 1 | -1 | 0 = 0
    if (s.selectedDate && selectedDate && s.selectedDate !== selectedDate) {
      dateChangeDirection = selectedDate > s.selectedDate ? 1 : -1
    }
    return { selectedDate, dateChangeDirection }
  }),
  setHoverExpandedId: (hoverExpandedId) => set({ hoverExpandedId }),
  setLockedExpandedId: (lockedExpandedId) => set({ lockedExpandedId }),
  setSuppressHoverUntilLeaveId: (suppressHoverUntilLeaveId) => set({ suppressHoverUntilLeaveId }),
  setItineraryScrollHandle: (itineraryScrollHandle) => set({ itineraryScrollHandle }),
  setFocusMode: (focusMode) => set({ focusMode }),
  resetDateChangeDirection: () => set({ dateChangeDirection: 0 }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}))
