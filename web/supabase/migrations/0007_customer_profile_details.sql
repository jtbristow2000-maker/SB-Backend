alter table public.customer_profiles
  add column if not exists vehicles text,
  add column if not exists po_box text,
  add column if not exists preferred_contact text,
  add column if not exists referral_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_profiles_preferred_contact_check'
      and conrelid = 'public.customer_profiles'::regclass
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_preferred_contact_check
      check (
        preferred_contact is null
        or preferred_contact in ('call', 'text', 'email')
      );
  end if;
end $$;
