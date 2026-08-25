-- FS-008C-C1: canonical persisted FS-008B -> FS-008C handoffs.
create table if not exists public.furnishing_onboarding_handoffs (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, workspace_id uuid not null, customer_id uuid not null,
 entitlement_id uuid not null unique references public.commercial_entitlements(id), offer_code text not null check(offer_code in('FS-CONSULT','FS-DESIGN')), offer_version integer not null check(offer_version>0),
 state text not null default 'pending' check(state in('pending','available','consumed','suspended','terminated')), purchase_reference text, session_id uuid unique, project_id uuid unique,
 version integer not null default 1 check(version>0), idempotency_key text not null unique, correlation_id text not null, created_at timestamptz not null default now(), available_at timestamptz, consumed_at timestamptz, terminated_at timestamptz, updated_at timestamptz not null default now()
);
create unique index if not exists furnishing_handoff_entitlement_idx on public.furnishing_onboarding_handoffs(entitlement_id);
create or replace function public.prevent_furnishing_handoff_lineage_mutation() returns trigger language plpgsql set search_path='' as $$ begin if old.entitlement_id<>new.entitlement_id or old.tenant_id<>new.tenant_id or old.workspace_id<>new.workspace_id or old.customer_id<>new.customer_id or old.offer_code<>new.offer_code or old.offer_version<>new.offer_version or old.state in('consumed','terminated') then raise exception 'FURNISHING_HANDOFF_IMMUTABLE'; end if; if new.version<>old.version+1 then raise exception 'FURNISHING_HANDOFF_VERSION'; end if; return new; end $$;
drop trigger if exists furnishing_handoff_lineage_immutable on public.furnishing_onboarding_handoffs;
create trigger furnishing_handoff_lineage_immutable before update or delete on public.furnishing_onboarding_handoffs for each row execute function public.prevent_furnishing_handoff_lineage_mutation();
alter table public.furnishing_onboarding_handoffs enable row level security;
create policy "customers read own furnishing handoffs" on public.furnishing_onboarding_handoffs for select to authenticated using(customer_id=auth.uid() and tenant_id in(select m.tenant_id from public.customer_account_memberships m where m.profile_id=auth.uid() and m.status='active'));
create policy "admins read furnishing handoffs" on public.furnishing_onboarding_handoffs for select to authenticated using(public.is_admin());
revoke all on public.furnishing_onboarding_handoffs from anon;
revoke insert,update,delete on public.furnishing_onboarding_handoffs from authenticated;
