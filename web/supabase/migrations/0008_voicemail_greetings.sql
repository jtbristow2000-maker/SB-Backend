create table if not exists public.voicemail_greetings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  audio_bytes bytea not null,
  content_type text not null default 'audio/wav',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voicemail_greetings_content_type_check check (content_type = 'audio/wav'),
  constraint voicemail_greetings_audio_size_check check (octet_length(audio_bytes) <= 1048576)
);

create index if not exists voicemail_greetings_business_id_idx
  on public.voicemail_greetings (business_id);

alter table public.voicemail_greetings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'voicemail_greetings'
      and policyname = 'voicemail_greetings_business_members_all'
  ) then
    create policy voicemail_greetings_business_members_all
      on public.voicemail_greetings
      for all
      using (
        business_id in (
          select business_id
          from public.business_members
          where user_id = auth.uid()
        )
      )
      with check (
        business_id in (
          select business_id
          from public.business_members
          where user_id = auth.uid()
        )
      );
  end if;
end $$;
