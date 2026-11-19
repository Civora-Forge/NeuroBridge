-- Persist the reflection and memory records already used by Role 4 repositories.
-- All statements are safe to apply to a database where these tables already exist.

create table if not exists public.support_reflections (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  intervention_id text,
  module_id text,
  reflection_id text,
  timestamp timestamptz,
  version integer not null default 1 check (version = 1),
  reflection_version integer not null default 1 check (reflection_version = 1),
  outcome_summary jsonb,
  insights jsonb not null default '[]'::jsonb,
  summary text not null,
  key_insights jsonb not null default '[]'::jsonb,
  follow_up_suggestions jsonb not null default '[]'::jsonb,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  evidence_outcome_ids text[] not null default '{}',
  privacy text not null default 'private' check (privacy in (
    'private', 'guardian', 'support', 'care_team', 'anonymous_aggregate'
  )),
  source text not null default 'system_inference' check (source in (
    'user_report', 'module_event', 'care_team', 'system_inference', 'imported_legacy'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.support_memories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  memory_id text,
  module_id text,
  category text check (category in (
    'preferred_configuration', 'successful_strategy', 'unsuccessful_configuration',
    'completion_pattern', 'feedback_pattern'
  )),
  type text not null check (type in (
    'preference', 'successful_strategy', 'ineffective_strategy', 'accessibility_preference',
    'learning_pattern', 'trigger_pattern', 'support_boundary', 'care_team_preference',
    'interaction_pattern'
  )),
  key text not null,
  value jsonb not null,
  evidence_count integer check (evidence_count >= 0),
  supporting_reflection_ids text[] not null default '{}',
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  confidence_level text check (confidence_level in ('low', 'moderate', 'high')),
  first_observed_at timestamptz,
  last_updated_at timestamptz,
  version integer not null default 1 check (version = 1),
  status text not null default 'active' check (status in ('active', 'superseded', 'deleted')),
  contradiction_count integer not null default 0 check (contradiction_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  privacy text not null default 'private' check (privacy in (
    'private', 'guardian', 'support', 'care_team', 'anonymous_aggregate'
  )),
  source text not null default 'system_inference' check (source in (
    'user_report', 'module_event', 'care_team', 'system_inference', 'imported_legacy'
  )),
  evidence_ids text[] not null default '{}',
  expires_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists support_reflections_user_id_created_at_idx
  on public.support_reflections (user_id, created_at desc);
create index if not exists support_reflections_user_id_module_id_idx
  on public.support_reflections (user_id, module_id);
create index if not exists support_memories_user_id_created_at_idx
  on public.support_memories (user_id, created_at desc);
create index if not exists support_memories_user_id_module_id_idx
  on public.support_memories (user_id, module_id);

alter table public.support_reflections enable row level security;
alter table public.support_memories enable row level security;

grant select, insert, update, delete on public.support_reflections to authenticated;
grant select, insert, update, delete on public.support_memories to authenticated;

drop policy if exists "Users can select their support reflections" on public.support_reflections;
drop policy if exists "Users can insert their support reflections" on public.support_reflections;
drop policy if exists "Users can update their support reflections" on public.support_reflections;
drop policy if exists "Users can delete their support reflections" on public.support_reflections;
create policy "Users can select their support reflections"
  on public.support_reflections for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their support reflections"
  on public.support_reflections for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their support reflections"
  on public.support_reflections for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their support reflections"
  on public.support_reflections for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can select their support memories" on public.support_memories;
drop policy if exists "Users can insert their support memories" on public.support_memories;
drop policy if exists "Users can update their support memories" on public.support_memories;
drop policy if exists "Users can delete their support memories" on public.support_memories;
create policy "Users can select their support memories"
  on public.support_memories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their support memories"
  on public.support_memories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their support memories"
  on public.support_memories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their support memories"
  on public.support_memories for delete to authenticated
  using ((select auth.uid()) = user_id);
