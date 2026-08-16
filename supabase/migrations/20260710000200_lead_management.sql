alter table public.contact_inquiries
add column if not exists internal_notes text;

alter table public.contact_inquiries
add column if not exists assigned_to uuid;

alter table public.contact_inquiries
add column if not exists responded_at timestamptz;

alter table public.contact_inquiries
add column if not exists closed_at timestamptz;
