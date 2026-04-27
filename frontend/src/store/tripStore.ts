import { create } from 'zustand'
import { createClient } from '@/lib/supabase'
import { useUIStore } from '@/store/uiStore'

export interface TripPlan {
  id: string
  destination: string
  origin_city: string | null
  start_date: string
  end_date: string
  budget_range: string
  currency?: string | null
  destination_timezone: string | null
  destination_latitude: number | null
  destination_longitude: number | null
  number_of_travelers: number
  user_timezone: string | null
  created_at?: string
}

export interface PlanItem {
  id: string
  trip_id: string
  day_number: number
  date: string | null
  sort_order?: number | null
  time_slot?: string | null
  start_time: string | null
  end_time: string | null
  activity_type: string
  title: string
  description?: string | null
  location_name: string | null
  address: string | null
  latitude?: number | null
  longitude?: number | null
  cost_estimate?: number | null
  currency?: string | null
  duration_minutes: number
  priority?: string | null
  notes?: string | null
  tags: string[]
  is_booked?: boolean
  booking_url?: string | null
  source?: 'human' | 'ai' | 'ai_suggested'
}

function toPayload(item: PlanItem): Record<string, unknown> {
  return { ...item }
}

interface TripState {
  tripPlan: TripPlan | null
  planItems: PlanItem[]
  recentlyAddedIds: Set<string>
  activeLoadId: string | null
  setTripPlan: (plan: TripPlan) => void
  setPlanItems: (items: PlanItem[]) => void
  // Preferred atomic setter for trip switching — writes tripPlan, planItems, and selectedDate
  // in one set() call so no render fires with mismatched trip IDs.
  setActiveTrip: (payload: { tripPlan: TripPlan; planItems: PlanItem[] }) => void
  setActiveLoadId: (id: string | null) => void
  clearTrip: () => void
  markAsRecentlyAdded: (id: string) => void
  insertPlanItemLocal: (item: PlanItem) => void
  addPlanItem: (input: Partial<PlanItem> & {
    title: string;
    activity_type: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    date: string;
  }) => Promise<PlanItem>
}

/** Parse a YYYY-MM-DD string into a UTC midnight timestamp (ms). */
function dateStringToUTCMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export const useTripStore = create<TripState>((set, get) => ({
  tripPlan: null,
  planItems: [],
  recentlyAddedIds: new Set<string>(),
  activeLoadId: null,
  setActiveLoadId: (activeLoadId) => set({ activeLoadId }),
  setActiveTrip: ({ tripPlan, planItems }) => {
    set({ tripPlan, planItems })
    useUIStore.getState().setSelectedDate(tripPlan.start_date)
  },
  setTripPlan: (tripPlan) => {
    set({ tripPlan })
    useUIStore.getState().setSelectedDate(tripPlan.start_date)
  },
  setPlanItems: (planItems) => set({ planItems }),
  clearTrip: () => {
    set({ tripPlan: null, planItems: [], recentlyAddedIds: new Set<string>() })
    useUIStore.getState().setSelectedDate(null)
  },
  insertPlanItemLocal: (item) => set((s) => ({
    planItems: [...s.planItems, item],
  })),
  markAsRecentlyAdded: (id) => {
    set((s) => {
      const next = new Set(s.recentlyAddedIds)
      next.add(id)
      return { recentlyAddedIds: next }
    })
    setTimeout(() => {
      set((s) => {
        if (!s.recentlyAddedIds.has(id)) return s
        const next = new Set(s.recentlyAddedIds)
        next.delete(id)
        return { recentlyAddedIds: next }
      })
    }, 1800)
  },
  addPlanItem: async (input) => {
    // Capture tripPlan BEFORE any await to avoid stale-closure race.
    const tripPlan = get().tripPlan
    const tripPlanId = tripPlan?.id
    if (!tripPlanId || !tripPlan) {
      throw new Error('No trip loaded')
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // DST-safe day-number calculation using UTC-UTC diff.
    const tripStartMs = dateStringToUTCMs(tripPlan.start_date)
    const itemDateMs = dateStringToUTCMs(input.date)
    const dayNumber = Math.round((itemDateMs - tripStartMs) / 86400000) + 1

    const insertPayload = {
      trip_id: tripPlanId,
      title: input.title,
      activity_type: input.activity_type,
      priority: input.priority ?? 'nice_to_have',
      start_time: input.start_time,
      end_time: input.end_time,
      duration_minutes: input.duration_minutes,
      date: input.date,
      day_number: dayNumber,
      cost_estimate: input.cost_estimate ?? 0,
      location_name: input.location_name ?? null,
      address: input.address ?? null,
      is_booked: false,
      tags: input.tags ?? [],
      source: 'human' as const,
    }

    const { data, error } = await supabase
      .from('plan_items')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    const newItem = data as PlanItem

    try {
      const { useHistoryStore } = await import('@/store/historyStore')
      useHistoryStore.getState().recordEvent({
        tripPlanId,
        sessionId: null,
        userId: user.id,
        eventType: 'activity_added',
        actor: 'human',
        payloadBefore: null,
        payloadAfter: toPayload(newItem),
        context: {
          title: newItem.title,
          date: newItem.date,
          start_time: newItem.start_time,
          end_time: newItem.end_time,
          activity_type: newItem.activity_type,
          duration_minutes: newItem.duration_minutes,
          source: 'human',
          trigger: 'add_dialog',
        },
      })
    } catch {
      // historyStore optional
    }

    return newItem
  },
}))
