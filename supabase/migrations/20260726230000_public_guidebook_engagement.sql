-- GBS-005A: public renderer engagement hooks and version provenance.
begin;
alter table public.guidebook_analytics drop constraint if exists guidebook_analytics_event_type_check;
alter table public.guidebook_analytics add constraint guidebook_analytics_event_type_check check(event_type in('view','qr-scan','section-open','link-click','map-open','phone-tap','guidebook-completed'));
alter table public.guidebook_analytics
  add column if not exists artifact_version text,
  add column if not exists renderer_version text,
  add column if not exists session_hash text,
  add column if not exists reservation_id uuid references public.bookings(id) on delete set null,
  add column if not exists guest_id uuid references public.guests(id) on delete set null;
create index if not exists guidebook_analytics_session_idx on public.guidebook_analytics(guidebook_id,session_hash,occurred_at desc);
commit;
