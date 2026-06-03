alter table public.businesses
  add column if not exists twilio_number_e164 text,
  add column if not exists twilio_number_sid text,
  add column if not exists number_status text not null default 'none',
  add column if not exists number_trial_ends_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_number_status_check'
  ) then
    alter table public.businesses
      add constraint businesses_number_status_check
      check (number_status in ('none', 'trial', 'active', 'porting', 'ported'));
  end if;
end $$;

create unique index if not exists businesses_twilio_number_e164_idx
  on public.businesses(twilio_number_e164)
  where twilio_number_e164 is not null;

create table if not exists public.number_port_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  current_number_e164 text not null,
  current_carrier text,
  account_number text,
  account_pin text,
  billing_name text,
  billing_address text,
  loa_signed_at timestamptz,
  bill_uploaded boolean not null default false,
  status text not null default 'collecting',
  created_at timestamptz not null default now(),
  constraint number_port_requests_status_check
    check (status in ('collecting', 'submitted', 'completed', 'rejected'))
);

create index if not exists number_port_requests_business_id_created_at_idx
  on public.number_port_requests(business_id, created_at desc);

alter table public.number_port_requests enable row level security;

drop policy if exists "number_port_requests_select_by_membership" on public.number_port_requests;
create policy "number_port_requests_select_by_membership"
  on public.number_port_requests
  for select
  using (business_id = any(public.current_user_business_ids()));

drop policy if exists "number_port_requests_insert_by_membership" on public.number_port_requests;
create policy "number_port_requests_insert_by_membership"
  on public.number_port_requests
  for insert
  with check (business_id = any(public.current_user_business_ids()));

drop policy if exists "number_port_requests_update_by_membership" on public.number_port_requests;
create policy "number_port_requests_update_by_membership"
  on public.number_port_requests
  for update
  using (business_id = any(public.current_user_business_ids()))
  with check (business_id = any(public.current_user_business_ids()));
