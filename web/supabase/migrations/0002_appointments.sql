create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles (id) on delete set null,
  source_call_record_id uuid references public.call_records (id) on delete set null,
  title text not null,
  service_requested text,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  timezone text not null default 'America/New_York',
  status text not null default 'scheduled',
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_business_start_idx
  on public.appointments (business_id, scheduled_start_at);

create index if not exists appointments_business_status_idx
  on public.appointments (business_id, status);

create index if not exists appointments_customer_profile_idx
  on public.appointments (customer_profile_id);
