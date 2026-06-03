create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists business_members_user_idx
  on public.business_members (user_id);

create index if not exists business_members_business_idx
  on public.business_members (business_id);
