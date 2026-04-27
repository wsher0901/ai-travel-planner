import { create } from 'zustand'
import { createClient } from '@/lib/supabase'

export interface TripIndex {
  id: string
  destination: string
  start_date: string | null
  end_date: string | null
  created_at: string
  item_count: number
}

interface TripsIndexState {
  trips: TripIndex[]
  loading: boolean
  fetchTrips: (userId: string) => Promise<void>
  addTripToIndex: (trip: TripIndex) => void
  removeTripFromIndex: (id: string) => void
  upsertTripInIndex: (patch: Partial<TripIndex> & { id: string }) => void
}

export const useTripsIndexStore = create<TripsIndexState>((set) => ({
  trips: [],
  loading: false,

  fetchTrips: async (userId) => {
    set({ loading: true })
    const supabase = createClient()

    const { data: tripRows, error: tripErr } = await supabase
      .from('trip_plans')
      .select('id, destination, start_date, end_date, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (tripErr) {
      console.error('[tripsIndexStore] fetchTrips trip_plans error:', tripErr)
      set({ trips: [], loading: false })
      return
    }

    const trips = tripRows ?? []
    if (trips.length === 0) {
      set({ trips: [], loading: false })
      return
    }

    const tripIds = trips.map((t) => t.id)
    const { data: items, error: itemErr } = await supabase
      .from('plan_items')
      .select('trip_id')
      .in('trip_id', tripIds)

    if (itemErr) {
      console.error('[tripsIndexStore] fetchTrips plan_items error:', itemErr)
    }

    const counts: Record<string, number> = {}
    for (const it of (items ?? []) as { trip_id: string }[]) {
      counts[it.trip_id] = (counts[it.trip_id] ?? 0) + 1
    }

    set({
      trips: trips.map((t) => ({
        id: t.id,
        destination: t.destination,
        start_date: t.start_date,
        end_date: t.end_date,
        created_at: t.created_at,
        item_count: counts[t.id] ?? 0,
      })),
      loading: false,
    })
  },

  addTripToIndex: (trip) =>
    set((s) => (s.trips.some((t) => t.id === trip.id) ? s : { trips: [trip, ...s.trips] })),

  removeTripFromIndex: (id) =>
    set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),

  upsertTripInIndex: (patch) =>
    set((s) => ({
      trips: s.trips.map((t) => (t.id === patch.id ? ({ ...t, ...patch } as TripIndex) : t)),
    })),
}))
