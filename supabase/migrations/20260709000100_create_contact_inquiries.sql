create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  email text not null,
  phone text,

  inquiry_type text not null,
  property_market text,
  message text not null,

  source text not null default 'contact_page',
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'responded', 'closed')),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_inquiries_status_idx
  on public.contact_inquiries (status);

create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries (created_at desc);

create index if not exists contact_inquiries_inquiry_type_idx
  on public.contact_inquiries (inquiry_type);

alter table public.contact_inquiries enable row level security;

grant select, insert, update, delete
on public.contact_inquiries
to authenticated;

drop policy if exists "Admins can manage contact inquiries"
on public.contact_inquiries;

create policy "Admins can manage contact inquiries"
on public.contact_inquiries
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
