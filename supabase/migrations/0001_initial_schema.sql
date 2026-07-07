create extension if not exists "pgcrypto";

create type public.user_role as enum ('guest', 'owner', 'admin', 'cleaner');
create type public.property_status as enum ('draft', 'active', 'paused', 'archived');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type public.issue_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.issue_status as enum ('open', 'assigned', 'in_progress', 'resolved');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  role public.user_role not null default 'guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null,
  address text,
  city text not null,
  state text not null,
  bedrooms int not null default 1,
  bathrooms numeric(3,1) not null default 1,
  max_guests int not null default 2,
  nightly_rate numeric(10,2) not null default 0,
  amenities text[] not null default '{}',
  images text[] not null default '{}',
  status public.property_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_id uuid references public.profiles(id) on delete set null,
  check_in date not null,
  check_out date not null,
  guests int not null default 1,
  total_amount numeric(10,2) not null default 0,
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint valid_booking_dates check (check_out > check_in)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  priority public.issue_priority not null default 'medium',
  description text not null,
  status public.issue_status not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.maintenance_requests enable row level security;

create policy "Public can read active properties" on public.properties for select using (status = 'active');
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Owners can read their properties" on public.properties for select using (auth.uid() = owner_id);
create policy "Guests can read own bookings" on public.bookings for select using (auth.uid() = guest_id);
