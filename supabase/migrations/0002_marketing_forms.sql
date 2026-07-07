create type public.contact_inquiry_status as enum ('new', 'reviewed', 'responded', 'closed');

create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  inquiry_type text not null,
  property_market text,
  message text not null,
  source text not null default 'contact_page',
  status public.contact_inquiry_status not null default 'new',
  created_at timestamptz not null default now()
);

create table public.lead_magnet_downloads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  property_market text not null,
  property_status text not null,
  lead_magnet text not null default 'str_revenue_readiness_checklist',
  created_at timestamptz not null default now()
);

alter table public.contact_inquiries enable row level security;
alter table public.lead_magnet_downloads enable row level security;

-- These records are inserted by Next.js server actions with the Supabase service role key.
-- No public insert/select policy is created so lead information remains private.
