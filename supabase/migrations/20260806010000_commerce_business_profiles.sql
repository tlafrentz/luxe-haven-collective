-- UX-001 Chapter 2: workspace-configuration + business-profile answers collected during commerce onboarding.
create table public.commerce_business_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  workspace_id uuid references public.owners(id),
  business_type text not null check (business_type in ('individual-owner','co-host','small-portfolio','enterprise')),
  property_count text not null check (property_count in ('1','2-5','6-20','20+')),
  primary_goal text not null check (primary_goal in ('increase-revenue','guest-experience','launch-property','investment','operations')),
  integrations jsonb not null default '[]'::jsonb,
  preferred_onboarding_date date,
  plan_slug text not null,
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

alter table public.commerce_business_profiles enable row level security;

create policy "Owner reads own business profile"
on public.commerce_business_profiles for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy "Owner writes own business profile"
on public.commerce_business_profiles for insert
to authenticated
with check (profile_id = auth.uid());

create policy "Owner updates own business profile"
on public.commerce_business_profiles for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
