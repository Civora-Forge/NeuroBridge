-- Role 4 initial persistence: intervention lifecycle only.
-- This migration is additive and intentionally does not modify existing tables,
-- policies, Auth configuration, or non-Role-4 features.

create table public.support_interventions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  module_id text not null,
  intervention_type text not null,
  category text not null check (category in (
    'executive', 'emotional', 'learning', 'sensory', 'motor', 'specialized', 'care_sync'
  )),
  status text not null default 'recommended' check (status in (
    'recommended', 'shown', 'accepted', 'started', 'progressed', 'in_progress',
    'paused', 'completed', 'partially_completed', 'abandoned', 'cancelled', 'failed',
    'blocked', 'dismissed', 'rated', 'escalated', 'follow_up_created'
  )),
  title text not null,
  description text,
  route text,
  source text not null default 'system_inference' check (source in (
    'user_report', 'module_event', 'care_team', 'system_inference', 'imported_legacy'
  )),
  privacy text not null default 'private' check (privacy in (
    'private', 'guardian', 'support', 'care_team', 'anonymous_aggregate'
  )),
  tags text[] not null default '{}',
  parameters jsonb not null default '{}'::jsonb,
  rationale text,
  context_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.support_lifecycle_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  intervention_id text not null,
  schema_version integer not null default 1 check (schema_version = 1),
  module_id text not null,
  intervention_type text not null,
  from_status text check (from_status in (
    'recommended', 'shown', 'accepted', 'started', 'progressed', 'in_progress',
    'paused', 'completed', 'partially_completed', 'abandoned', 'cancelled', 'failed',
    'blocked', 'dismissed', 'rated', 'escalated', 'follow_up_created'
  )),
  to_status text not null check (to_status in (
    'recommended', 'shown', 'accepted', 'started', 'progressed', 'in_progress',
    'paused', 'completed', 'partially_completed', 'abandoned', 'cancelled', 'failed',
    'blocked', 'dismissed', 'rated', 'escalated', 'follow_up_created'
  )),
  source text not null default 'module_event' check (source in (
    'user_report', 'module_event', 'care_team', 'system_inference', 'imported_legacy'
  )),
  privacy text not null default 'private' check (privacy in (
    'private', 'guardian', 'support', 'care_team', 'anonymous_aggregate'
  )),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  context_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (intervention_id, user_id)
    references public.support_interventions(id, user_id)
    on delete cascade
);

create table public.support_outcomes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  intervention_id text not null,
  schema_version integer not null default 1 check (schema_version = 1),
  module_id text not null,
  intervention_type text not null,
  category text not null check (category in (
    'executive', 'emotional', 'learning', 'sensory', 'motor', 'specialized', 'care_sync'
  )),
  status text not null check (status in (
    'recommended', 'shown', 'accepted', 'started', 'progressed', 'in_progress',
    'paused', 'completed', 'partially_completed', 'abandoned', 'cancelled', 'failed',
    'blocked', 'dismissed', 'rated', 'escalated', 'follow_up_created'
  )),
  source text not null default 'module_event' check (source in (
    'user_report', 'module_event', 'care_team', 'system_inference', 'imported_legacy'
  )),
  privacy text not null default 'private' check (privacy in (
    'private', 'guardian', 'support', 'care_team', 'anonymous_aggregate'
  )),
  accepted boolean,
  completed boolean,
  duration_ms bigint check (duration_ms >= 0),
  rating numeric check (rating >= 1 and rating <= 5),
  user_feedback text,
  metrics jsonb not null default '{}'::jsonb,
  context_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (intervention_id, user_id)
    references public.support_interventions(id, user_id)
    on delete cascade
);

create index support_interventions_user_id_created_at_idx
  on public.support_interventions (user_id, created_at desc);
create index support_interventions_module_id_idx
  on public.support_interventions (module_id);

create index support_lifecycle_events_intervention_id_created_at_idx
  on public.support_lifecycle_events (intervention_id, created_at asc);
create index support_lifecycle_events_user_id_created_at_idx
  on public.support_lifecycle_events (user_id, created_at desc);
create index support_lifecycle_events_module_id_idx
  on public.support_lifecycle_events (module_id);

create index support_outcomes_intervention_id_created_at_idx
  on public.support_outcomes (intervention_id, created_at asc);
create index support_outcomes_user_id_created_at_idx
  on public.support_outcomes (user_id, created_at desc);
create index support_outcomes_module_id_idx
  on public.support_outcomes (module_id);

alter table public.support_interventions enable row level security;
alter table public.support_lifecycle_events enable row level security;
alter table public.support_outcomes enable row level security;

grant select, insert, update, delete on public.support_interventions to authenticated;
grant select, insert on public.support_lifecycle_events to authenticated;
grant select, insert on public.support_outcomes to authenticated;

create policy "Users can select their support interventions"
  on public.support_interventions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their support interventions"
  on public.support_interventions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their support interventions"
  on public.support_interventions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their support interventions"
  on public.support_interventions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can select their support lifecycle events"
  on public.support_lifecycle_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their support lifecycle events"
  on public.support_lifecycle_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can select their support outcomes"
  on public.support_outcomes for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their support outcomes"
  on public.support_outcomes for insert to authenticated
  with check ((select auth.uid()) = user_id);
