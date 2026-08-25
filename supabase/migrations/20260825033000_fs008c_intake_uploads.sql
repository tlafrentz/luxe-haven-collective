-- FS-008C-P2.3C: private, session/property-bound intake upload metadata.
create table if not exists public.furnishing_onboarding_uploads (
 id uuid primary key, tenant_id uuid not null, session_id uuid not null references public.furnishing_onboarding_sessions(id), property_id uuid not null,
 room_id uuid, purpose text not null check(purpose in('property_photo','room_photo','floor_plan','measurement_document','existing_inventory_photo','listing_reference','design_inspiration','other_approved_reference')),
 original_filename text not null, object_key text not null unique, mime_type text not null, size_bytes bigint not null check(size_bytes>0), state text not null default 'requested' check(state in('requested','uploading','uploaded','validating','available','rejected','failed','removed','expired')),
 validation_reason text, actor_id uuid not null references public.profiles(id), version integer not null default 1, idempotency_key text not null unique, created_at timestamptz not null default now(), finalized_at timestamptz, removed_at timestamptz
);
alter table public.furnishing_onboarding_uploads enable row level security;
create policy "customers read own furnishing uploads" on public.furnishing_onboarding_uploads for select to authenticated using(actor_id=auth.uid() and tenant_id in(select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active') and state='available');
create policy "admins read available furnishing uploads" on public.furnishing_onboarding_uploads for select to authenticated using(public.is_admin() and state='available');
revoke all on public.furnishing_onboarding_uploads from anon;
revoke insert,update,delete on public.furnishing_onboarding_uploads from authenticated;
