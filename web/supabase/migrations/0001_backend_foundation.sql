create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text,
  owner_phone_e164 text,
  business_phone_e164 text,
  timezone text not null default 'America/New_York',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists businesses_business_phone_e164_idx
  on public.businesses (business_phone_e164);

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  display_name text,
  phone_e164 text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  source text,
  status text not null default 'new',
  summary text,
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_profiles_business_phone_e164_key
  on public.customer_profiles (business_id, phone_e164)
  where phone_e164 is not null;

create index if not exists customer_profiles_business_status_idx
  on public.customer_profiles (business_id, status);

create index if not exists customer_profiles_business_last_contact_idx
  on public.customer_profiles (business_id, last_contact_at desc);

create table if not exists public.call_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles (id) on delete set null,
  provider text not null default 'sandbox',
  provider_call_id text,
  direction text not null,
  call_type text not null,
  from_phone_e164 text,
  to_phone_e164 text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  transcript text,
  ai_summary text,
  extracted_json jsonb not null default '{}'::jsonb,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists call_records_business_provider_call_idx
  on public.call_records (business_id, provider, provider_call_id);

create index if not exists call_records_business_started_idx
  on public.call_records (business_id, started_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles (id) on delete set null,
  provider text not null default 'sandbox',
  provider_message_id text,
  direction text not null,
  channel text not null,
  from_phone_e164 text,
  to_phone_e164 text,
  body text,
  media_json jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_business_provider_message_idx
  on public.messages (business_id, provider, provider_message_id);

create index if not exists messages_business_sent_idx
  on public.messages (business_id, sent_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_profile_id uuid references public.customer_profiles (id) on delete set null,
  task_type text not null,
  title text not null,
  notes text,
  due_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_business_status_idx
  on public.tasks (business_id, status);

create index if not exists tasks_business_due_idx
  on public.tasks (business_id, due_at);
