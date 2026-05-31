create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles (id) on delete set null,
  actor text not null default 'system',
  event_type text not null,
  event_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_business_created_idx
  on public.audit_events (business_id, created_at desc);

create index if not exists audit_events_customer_profile_idx
  on public.audit_events (customer_profile_id);
