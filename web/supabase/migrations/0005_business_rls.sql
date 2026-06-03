create or replace function public.current_user_business_ids()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(business_id), '{}'::uuid[])
  from public.business_members
  where user_id = auth.uid();
$$;

revoke all on function public.current_user_business_ids() from public;
grant execute on function public.current_user_business_ids() to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.call_records enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.quote_drafts enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists businesses_member_access on public.businesses;
create policy businesses_member_access
  on public.businesses
  for all
  to authenticated
  using (id = any(public.current_user_business_ids()))
  with check (id = any(public.current_user_business_ids()));

drop policy if exists business_members_member_access on public.business_members;
create policy business_members_member_access
  on public.business_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or business_id = any(public.current_user_business_ids())
  );

drop policy if exists business_members_member_insert on public.business_members;
create policy business_members_member_insert
  on public.business_members
  for insert
  to authenticated
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists customer_profiles_member_access on public.customer_profiles;
create policy customer_profiles_member_access
  on public.customer_profiles
  for all
  to authenticated
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists call_records_member_access on public.call_records;
create policy call_records_member_access
  on public.call_records
  for all
  to authenticated
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists messages_member_access on public.messages;
create policy messages_member_access
  on public.messages
  for all
  to authenticated
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists tasks_member_access on public.tasks;
create policy tasks_member_access
  on public.tasks
  for all
  to authenticated
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists appointments_member_access on public.appointments;
create policy appointments_member_access
  on public.appointments
  for all
  to authenticated
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists quote_drafts_member_access on public.quote_drafts;
create policy quote_drafts_member_access
  on public.quote_drafts
  for all
  to authenticated
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists audit_events_member_access on public.audit_events;
create policy audit_events_member_access
  on public.audit_events
  for all
  to authenticated
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));
