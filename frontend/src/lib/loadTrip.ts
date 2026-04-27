import type { SupabaseClient } from '@supabase/supabase-js'
import type { TripPlan, PlanItem } from '@/store/tripStore'

export interface LoadedTrip {
  tripPlan: TripPlan
  planItems: PlanItem[]
}

/**
 * Fetches a single trip + its plan_items, scoped to the given user.
 * Returns null if the trip doesn't exist or belongs to another user —
 * callers should treat that as "cleanup stale sessionStorage".
 */
export async function loadTrip(
  supabase: SupabaseClient,
  tripId: string,
  userId: string,
  signal?: AbortSignal
): Promise<LoadedTrip | null> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const tripQ = supabase
    .from('trip_plans')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', userId)

  const { data: trip, error: tripErr } = await (
    signal ? tripQ.abortSignal(signal) : tripQ
  ).maybeSingle()

  if (tripErr) {
    console.error('[loadTrip] trip_plans query failed:', tripErr)
    return null
  }
  if (!trip) return null

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const itemsQ = supabase
    .from('plan_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true })
    .order('start_time', { ascending: true })

  const { data: items, error: itemErr } = await (
    signal ? itemsQ.abortSignal(signal) : itemsQ
  )

  if (itemErr) {
    console.error('[loadTrip] plan_items query failed:', itemErr)
    return null
  }

  return { tripPlan: trip as TripPlan, planItems: (items ?? []) as PlanItem[] }
}
