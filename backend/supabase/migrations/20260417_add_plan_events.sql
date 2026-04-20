create table if not exists public.plan_events (
  id uuid primary key default gen_random_uuid(),
  trip_plan_id uuid references public.trip_plans(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  event_type text not null,
  actor text not null check (actor in ('human', 'ai', 'system')),
  payload_before jsonb,
  payload_after jsonb,
  context_json jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists idx_plan_events_trip on public.plan_events(trip_plan_id, created_at desc);
create index if not exists idx_plan_events_user on public.plan_events(user_id, created_at desc);
create index if not exists idx_plan_events_type on public.plan_events(event_type);

alter table public.plan_events enable row level security;

create policy "Users can view their own plan events"
  on public.plan_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own plan events"
  on public.plan_events for insert
  with check (auth.uid() = user_id);
