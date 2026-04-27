import { create } from 'zustand';
import { createClient } from '@/lib/supabase';

export type EventType =
  | 'activity_added'
  | 'activity_removed'
  | 'activity_edited'
  | 'activity_reordered'
  | 'date_range_changed'
  | 'plan_generated'
  | 'plan_reverted'
  | 'score_recalculated';

export type Actor = 'human' | 'ai' | 'system';

export interface PlanEvent {
  id: string;
  trip_plan_id: string | null;
  session_id: string | null;
  user_id: string | null;
  event_type: EventType;
  actor: Actor;
  payload_before: Record<string, unknown> | null;
  payload_after: Record<string, unknown> | null;
  context_json: Record<string, unknown> | null;
  created_at: string;
}

export interface HistoryState {
  events: PlanEvent[];
  loading: boolean;
  recordEvent: (args: {
    tripPlanId: string | null;
    sessionId: string | null;
    userId: string | null;
    eventType: EventType;
    actor: Actor;
    payloadBefore?: Record<string, unknown> | null;
    payloadAfter?: Record<string, unknown> | null;
    context?: Record<string, unknown> | null;
  }) => Promise<void>;
  loadEventsForTrip: (tripPlanId: string) => Promise<void>;
  clearEvents: () => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  events: [],
  loading: false,

  recordEvent: async ({
    tripPlanId,
    sessionId,
    userId,
    eventType,
    actor,
    payloadBefore = null,
    payloadAfter = null,
    context = null,
  }) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('plan_events')
      .insert({
        trip_plan_id: tripPlanId,
        session_id: sessionId,
        user_id: userId,
        event_type: eventType,
        actor,
        payload_before: payloadBefore,
        payload_after: payloadAfter,
        context_json: context,
      })
      .select()
      .single();

    if (error) {
      console.error('[historyStore] failed to record event:', error);
      return;
    }

    // Null-check before prepending — skip if insert returned no data.
    if (data) {
      set((state) => ({ events: [data as PlanEvent, ...state.events] }));
    }
  },

  loadEventsForTrip: async (tripPlanId: string) => {
    // Reset events and mark loading atomically.
    set({ loading: true, events: [] });
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('plan_events')
        .select('*')
        .eq('trip_plan_id', tripPlanId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[historyStore] failed to load events:', error);
        return;
      }

      set({ events: (data as PlanEvent[]) ?? [] });
    } finally {
      set({ loading: false });
    }
  },

  clearEvents: () => set({ events: [] }),
}));
