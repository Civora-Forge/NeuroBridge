-- Focus ratings update the terminal outcome rather than creating a second outcome.
grant update on public.support_outcomes to authenticated;

create policy "Users can update their support outcomes"
  on public.support_outcomes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
