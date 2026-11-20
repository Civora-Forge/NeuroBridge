-- Task 5: persistent cross-session / cross-device personalization profile.
-- One row per authenticated user. The profile document is validated and
-- sanitized client-side (src/adaptive/personalization/profileModel.js) against
-- a closed vocabulary of interaction preferences; it never holds diagnoses,
-- free text or behavioural event histories.
-- `revision` supports optimistic concurrency: clients update with
-- `where revision = <last read revision>` and merge + retry on zero rows.
-- Additive: does not modify existing tables or policies.

create table public.support_personalization_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint support_personalization_profiles_profile_object
    check (jsonb_typeof(profile) = 'object'),
  constraint support_personalization_profiles_profile_size
    check (pg_column_size(profile) <= 65536)
);

alter table public.support_personalization_profiles enable row level security;

grant select, insert, update, delete on public.support_personalization_profiles to authenticated;

create policy "Users can select their personalization profile"
  on public.support_personalization_profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their personalization profile"
  on public.support_personalization_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their personalization profile"
  on public.support_personalization_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their personalization profile"
  on public.support_personalization_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);
