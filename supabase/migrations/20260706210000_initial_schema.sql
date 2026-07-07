-- Luxe Haven Collective Platform
-- Production-ready initial Supabase migration
-- Created: 2026-07-06

-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =========================================================
-- Utility: updated_at trigger function
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Enums
-- =========================================================
do $$ begin
  create type public.user_role as enum ('guest', 'owner', 'admin', 'cleaner', 'contractor');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.property_status as enum ('draft', 'active', 'inactive', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid', 'authorized', 'paid', 'refunded', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.maintenance_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_status as enum ('open', 'assigned', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_type as enum ('contract', 'statement', 'invoice', 'permit', 'insurance', 'tax', 'other');
exception when duplicate_object then null;
end $$;

-- =========================================================
-- Profiles: mirrors auth.users with app-level role data
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  phone text,
  avatar_url text,
  role public.user_role not null default 'guest',
  is_active boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile when a Supabase auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'guest')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- Owners
-- =========================================================
create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_name text,
  mailing_address text,
  preferred_contact_method text default 'email',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id)
);

create trigger owners_set_updated_at
before update on public.owners
for each row execute function public.set_updated_at();

-- =========================================================
-- Properties
-- =========================================================
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.owners(id) on delete set null,
  name text not null,
  slug text not null unique,
  headline text,
  short_description text,
  description text,
  address_line_1 text,
  address_line_2 text,
  city text not null,
  state text not null,
  postal_code text,
  country text not null default 'US',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  bedrooms numeric(4, 1) not null default 0,
  bathrooms numeric(4, 1) not null default 0,
  beds numeric(4, 1) not null default 0,
  max_guests integer not null default 1 check (max_guests > 0),
  nightly_rate numeric(12, 2) not null default 0 check (nightly_rate >= 0),
  cleaning_fee numeric(12, 2) not null default 0 check (cleaning_fee >= 0),
  security_deposit numeric(12, 2) not null default 0 check (security_deposit >= 0),
  amenities text[] not null default '{}',
  house_rules text[] not null default '{}',
  image_urls text[] not null default '{}',
  featured_image_url text,
  check_in_time time default '16:00',
  check_out_time time default '10:00',
  status public.property_status not null default 'draft',
  is_featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_status_idx on public.properties(status);
create index if not exists properties_city_state_idx on public.properties(city, state);
create index if not exists properties_owner_id_idx on public.properties(owner_id);
create index if not exists properties_slug_idx on public.properties(slug);

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

-- =========================================================
-- Property images, for richer galleries later
-- =========================================================
create table if not exists public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists property_images_property_id_idx on public.property_images(property_id);

-- =========================================================
-- Bookings
-- =========================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  guest_id uuid references public.profiles(id) on delete set null,
  guest_full_name text,
  guest_email text,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  nightly_rate numeric(12, 2) not null default 0,
  cleaning_fee numeric(12, 2) not null default 0,
  taxes numeric(12, 2) not null default 0,
  service_fee numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  stripe_payment_intent_id text,
  source text not null default 'direct',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_valid_dates check (check_out > check_in)
);

create index if not exists bookings_property_id_idx on public.bookings(property_id);
create index if not exists bookings_guest_id_idx on public.bookings(guest_id);
create index if not exists bookings_check_in_out_idx on public.bookings(check_in, check_out);
create index if not exists bookings_status_idx on public.bookings(status);

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- Prevent overlapping confirmed bookings for the same property.
-- This allows pending/cancelled records without blocking availability.
create or replace function public.prevent_overlapping_confirmed_bookings()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmed' then
    if exists (
      select 1
      from public.bookings b
      where b.property_id = new.property_id
        and b.id <> new.id
        and b.status = 'confirmed'
        and daterange(b.check_in, b.check_out, '[)') && daterange(new.check_in, new.check_out, '[)')
    ) then
      raise exception 'Property is already booked for the selected dates.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_prevent_overlap on public.bookings;
create trigger bookings_prevent_overlap
before insert or update on public.bookings
for each row execute function public.prevent_overlapping_confirmed_bookings();

-- =========================================================
-- Messages
-- =========================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete set null,
  subject text,
  body text not null,
  is_internal boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_booking_id_idx on public.messages(booking_id);
create index if not exists messages_property_id_idx on public.messages(property_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists messages_recipient_id_idx on public.messages(recipient_id);

-- =========================================================
-- Leads and form submissions
-- =========================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  lead_type text not null default 'general', -- general, owner, guest, lead_magnet
  source text not null default 'website',
  status public.lead_status not null default 'new',
  message text,
  property_count integer,
  market text,
  estimated_monthly_revenue numeric(12, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_email_idx on public.leads(email);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_type_idx on public.leads(lead_type);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table if not exists public.lead_magnet_downloads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  full_name text,
  email text not null,
  resource_slug text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_magnet_downloads_email_idx on public.lead_magnet_downloads(email);
create index if not exists lead_magnet_downloads_resource_slug_idx on public.lead_magnet_downloads(resource_slug);

-- =========================================================
-- Maintenance requests
-- =========================================================
create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  priority public.maintenance_priority not null default 'medium',
  status public.task_status not null default 'open',
  due_date date,
  completed_at timestamptz,
  image_urls text[] not null default '{}',
  vendor_cost numeric(12, 2) default 0,
  owner_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_requests_property_id_idx on public.maintenance_requests(property_id);
create index if not exists maintenance_requests_status_idx on public.maintenance_requests(status);
create index if not exists maintenance_requests_assigned_to_idx on public.maintenance_requests(assigned_to);

create trigger maintenance_requests_set_updated_at
before update on public.maintenance_requests
for each row execute function public.set_updated_at();

-- =========================================================
-- Housekeeping tasks
-- =========================================================
create table if not exists public.housekeeping_tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null default 'Turnover clean',
  description text,
  scheduled_for date not null,
  start_time time,
  end_time time,
  status public.task_status not null default 'open',
  checklist jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists housekeeping_tasks_property_id_idx on public.housekeeping_tasks(property_id);
create index if not exists housekeeping_tasks_booking_id_idx on public.housekeeping_tasks(booking_id);
create index if not exists housekeeping_tasks_assigned_to_idx on public.housekeeping_tasks(assigned_to);
create index if not exists housekeeping_tasks_scheduled_for_idx on public.housekeeping_tasks(scheduled_for);

create trigger housekeeping_tasks_set_updated_at
before update on public.housekeeping_tasks
for each row execute function public.set_updated_at();

-- =========================================================
-- Owner statements and documents
-- =========================================================
create table if not exists public.owner_statements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_revenue numeric(12, 2) not null default 0,
  management_fees numeric(12, 2) not null default 0,
  cleaning_fees numeric(12, 2) not null default 0,
  maintenance_costs numeric(12, 2) not null default 0,
  net_payout numeric(12, 2) not null default 0,
  statement_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_statement_valid_period check (period_end >= period_start)
);

create index if not exists owner_statements_owner_id_idx on public.owner_statements(owner_id);
create index if not exists owner_statements_period_idx on public.owner_statements(period_start, period_end);

create trigger owner_statements_set_updated_at
before update on public.owner_statements
for each row execute function public.set_updated_at();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.owners(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  title text not null,
  document_type public.document_type not null default 'other',
  file_url text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists documents_owner_id_idx on public.documents(owner_id);
create index if not exists documents_property_id_idx on public.documents(property_id);

-- =========================================================
-- Reviews
-- =========================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  guest_id uuid references public.profiles(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  source text not null default 'direct',
  is_published boolean not null default false,
  host_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_property_id_idx on public.reviews(property_id);
create index if not exists reviews_is_published_idx on public.reviews(is_published);

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

-- =========================================================
-- Helper functions for RLS
-- =========================================================
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.owns_property(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.properties p
    join public.owners o on o.id = p.owner_id
    where p.id = target_property_id
      and o.profile_id = auth.uid()
  );
$$;

-- =========================================================
-- Enable RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.leads enable row level security;
alter table public.lead_magnet_downloads enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.housekeeping_tasks enable row level security;
alter table public.owner_statements enable row level security;
alter table public.documents enable row level security;
alter table public.reviews enable row level security;

-- =========================================================
-- RLS Policies: Profiles
-- =========================================================
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- RLS Policies: Owners
-- =========================================================
drop policy if exists "Owners can view own owner record" on public.owners;
create policy "Owners can view own owner record"
on public.owners for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage owners" on public.owners;
create policy "Admins can manage owners"
on public.owners for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- RLS Policies: Properties
-- =========================================================
drop policy if exists "Anyone can view active properties" on public.properties;
create policy "Anyone can view active properties"
on public.properties for select
to anon, authenticated
using (status = 'active');

drop policy if exists "Owners can view own properties" on public.properties;
create policy "Owners can view own properties"
on public.properties for select
to authenticated
using (public.owns_property(id) or public.is_admin());

drop policy if exists "Admins can manage properties" on public.properties;
create policy "Admins can manage properties"
on public.properties for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Property images follow parent property visibility
create policy "Anyone can view images for active properties"
on public.property_images for select
to anon, authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_images.property_id
      and p.status = 'active'
  )
  or public.owns_property(property_id)
  or public.is_admin()
);

create policy "Admins can manage property images"
on public.property_images for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- RLS Policies: Bookings
-- =========================================================
create policy "Guests can view own bookings"
on public.bookings for select
to authenticated
using (guest_id = auth.uid() or public.owns_property(property_id) or public.is_admin());

create policy "Guests can create own bookings"
on public.bookings for insert
to authenticated
with check (guest_id = auth.uid());

create policy "Admins can manage bookings"
on public.bookings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- RLS Policies: Messages
-- =========================================================
create policy "Users can view related messages"
on public.messages for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or public.owns_property(property_id)
  or public.is_admin()
);

create policy "Authenticated users can send messages"
on public.messages for insert
to authenticated
with check (sender_id = auth.uid() or public.is_admin());

create policy "Admins can manage messages"
on public.messages for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- RLS Policies: Leads
-- Website forms generally insert through server actions using service role.
-- Admins can read/manage leads from the dashboard.
-- =========================================================
create policy "Admins can manage leads"
on public.leads for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can manage lead magnet downloads"
on public.lead_magnet_downloads for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- RLS Policies: Maintenance / housekeeping
-- =========================================================
create policy "Owners can view property maintenance"
on public.maintenance_requests for select
to authenticated
using (public.owns_property(property_id) or assigned_to = auth.uid() or created_by = auth.uid() or public.is_admin());

create policy "Staff can update assigned maintenance"
on public.maintenance_requests for update
to authenticated
using (assigned_to = auth.uid() or public.is_admin())
with check (assigned_to = auth.uid() or public.is_admin());

create policy "Admins can manage maintenance"
on public.maintenance_requests for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users can view related housekeeping tasks"
on public.housekeeping_tasks for select
to authenticated
using (assigned_to = auth.uid() or public.owns_property(property_id) or public.is_admin());

create policy "Staff can update assigned housekeeping tasks"
on public.housekeeping_tasks for update
to authenticated
using (assigned_to = auth.uid() or public.is_admin())
with check (assigned_to = auth.uid() or public.is_admin());

create policy "Admins can manage housekeeping tasks"
on public.housekeeping_tasks for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- RLS Policies: Statements / documents / reviews
-- =========================================================
create policy "Owners can view own statements"
on public.owner_statements for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.owners o
    where o.id = owner_statements.owner_id
      and o.profile_id = auth.uid()
  )
);

create policy "Admins can manage owner statements"
on public.owner_statements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Owners can view related documents"
on public.documents for select
to authenticated
using (
  public.is_admin()
  or uploaded_by = auth.uid()
  or (property_id is not null and public.owns_property(property_id))
  or exists (
    select 1 from public.owners o
    where o.id = documents.owner_id
      and o.profile_id = auth.uid()
  )
);

create policy "Admins can manage documents"
on public.documents for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Anyone can view published reviews"
on public.reviews for select
to anon, authenticated
using (is_published = true);

create policy "Admins can manage reviews"
on public.reviews for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =========================================================
-- Seed sample public property content
-- Safe to remove later.
-- =========================================================
insert into public.properties (
  name,
  slug,
  headline,
  short_description,
  description,
  city,
  state,
  bedrooms,
  bathrooms,
  beds,
  max_guests,
  nightly_rate,
  cleaning_fee,
  amenities,
  house_rules,
  image_urls,
  featured_image_url,
  status,
  is_featured
)
values
(
  'Mesa Downtown Retreat',
  'mesa-downtown-retreat',
  'A polished desert escape minutes from dining, parks, and local attractions.',
  'A comfortable, design-forward stay with two queen bedrooms, thoughtful amenities, and easy access to Mesa and greater Phoenix.',
  'Mesa Downtown Retreat blends warm desert comfort with a polished guest experience. The home is designed for relaxed stays, productive work trips, and easy access to local dining, entertainment, parks, and regional attractions.',
  'Mesa',
  'AZ',
  2,
  1,
  2,
  4,
  168,
  125,
  array['Wi-Fi', 'Full kitchen', 'Smart TV', 'Washer and dryer', 'Dedicated workspace', 'Free parking', 'Air conditioning'],
  array['No smoking', 'No parties or events', 'Pets by approval only', 'Quiet hours after 10 PM'],
  array[]::text[],
  null,
  'active',
  true
)
on conflict (slug) do nothing;

-- =========================================================
-- End migration
-- =========================================================
