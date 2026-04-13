import { create } from 'zustand'

export interface TripPlan {
  id: string
  destination: string
  origin_city: string | null
  start_date: string
  end_date: string
  budget_range: string
  destination_timezone: string | null
  destination_latitude: number | null
  destination_longitude: number | null
  number_of_travelers: number
  user_timezone: string | null
}

export interface PlanItem {
  id: string
  trip_id: string
  day_number: number
  date: string | null
  sort_order: number
  time_slot: string
  start_time: string | null
  end_time: string | null
  activity_type: string
  title: string
  description: string
  location_name: string
  address: string
  latitude: number
  longitude: number
  cost_estimate: number
  currency: string
  duration_minutes: number
  priority: string
  notes: string
  tags: string[]
}

interface TripState {
  tripPlan: TripPlan | null
  planItems: PlanItem[]
  setTripPlan: (plan: TripPlan) => void
  setPlanItems: (items: PlanItem[]) => void
  clearTrip: () => void
}

export const useTripStore = create<TripState>((set) => ({
  tripPlan: null,
  planItems: [],
  setTripPlan: (tripPlan) => set({ tripPlan }),
  setPlanItems: (planItems) => set({ planItems }),
  clearTrip: () => set({ tripPlan: null, planItems: [] }),
}))
