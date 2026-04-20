import { create } from 'zustand'
import { createClient } from '@/lib/supabase'

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
  location_name: string | null
  address: string | null
  latitude: number
  longitude: number
  cost_estimate: number
  currency: string
  duration_minutes: number
  priority: string
  notes: string
  tags: string[]
  is_booked?: boolean
  booking_url?: string | null
}

interface TripState {
  tripPlan: TripPlan | null
  planItems: PlanItem[]
  setTripPlan: (plan: TripPlan) => void
  setPlanItems: (items: PlanItem[]) => void
  clearTrip: () => void
  addPlanItem: (input: Partial<PlanItem> & {
    title: string;
    activity_type: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    date: string;
  }) => Promise<PlanItem | null>
}

export const useTripStore = create<TripState>((set, get) => ({
  tripPlan: null,
  planItems: [],
  setTripPlan: (tripPlan) => set({ tripPlan }),
  setPlanItems: (planItems) => set({ planItems }),
  clearTrip: () => set({ tripPlan: null, planItems: [] }),
  addPlanItem: async (input) => {
    const state = get();
    const tripPlanId = state.tripPlan?.id;
    if (!tripPlanId) {
      console.error('[tripStore.addPlanItem] No tripPlan loaded');
      return null;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[tripStore.addPlanItem] Not authenticated');
      return null;
    }

    const tripStart = new Date(state.tripPlan!.start_date);
    const itemDate = new Date(input.date);
    const dayNumber = Math.round((itemDate.getTime() - tripStart.getTime()) / 86400000) + 1;

    const insertPayload = {
      trip_plan_id: tripPlanId,
      title: input.title,
      activity_type: input.activity_type,
      priority: input.priority ?? 'flexible',
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
    };

    const { data, error } = await supabase
      .from('plan_items')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[tripStore.addPlanItem] Insert failed:', error);
      return null;
    }

    const newItem = data as PlanItem;

    set((s) => ({ planItems: [...s.planItems, newItem] }));

    try {
      const { useHistoryStore } = await import('@/store/historyStore');
      useHistoryStore.getState().recordEvent({
        tripPlanId,
        sessionId: null,
        userId: user.id,
        eventType: 'activity_added',
        actor: 'human',
        payloadBefore: null,
        payloadAfter: newItem as unknown as Record<string, unknown>,
        context: { source: 'add_dialog' },
      });
    } catch {
      // historyStore optional
    }

    return newItem;
  },
}))
