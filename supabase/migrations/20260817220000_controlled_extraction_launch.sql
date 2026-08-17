create table public.guidebook_controlled_extraction_launches(
  id uuid primary key default gen_random_uuid(),
  operation_code text not null check(operation_code='controlled_guidebook_extraction_v2'),
  verification_run_id uuid not null references public.production_verification_runs(id),
  actor_id uuid not null references public.profiles(id),
  customer_account_id uuid not null references public.customer_accounts(id),
  entitlement_id uuid not null references public.commercial_entitlements(id),
  status text not null check(status in('armed','running','cleanup_required','closed_succeeded','closed_failed')),
  correlation_id text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique(operation_code),unique(verification_run_id)
);
alter table public.guidebook_controlled_extraction_launches enable row level security;
create policy "admins read controlled extraction launches" on public.guidebook_controlled_extraction_launches for select to authenticated using(public.is_admin());
revoke all on public.guidebook_controlled_extraction_launches from anon,authenticated;
create function public.prevent_controlled_extraction_launch_mutation()returns trigger language plpgsql set search_path='' as $$begin
 if old.status in('closed_succeeded','closed_failed')then raise exception'CONTROLLED_EXTRACTION_LAUNCH_CLOSED';end if;
 if new.operation_code<>old.operation_code or new.verification_run_id<>old.verification_run_id or new.actor_id<>old.actor_id or new.customer_account_id<>old.customer_account_id or new.entitlement_id<>old.entitlement_id or new.correlation_id<>old.correlation_id or new.created_at<>old.created_at then raise exception'CONTROLLED_EXTRACTION_LAUNCH_IMMUTABLE';end if;
 return new;
end$$;
create trigger controlled_extraction_launch_guard before update on public.guidebook_controlled_extraction_launches for each row execute function public.prevent_controlled_extraction_launch_mutation();
create function public.prevent_controlled_extraction_launch_delete()returns trigger language plpgsql set search_path='' as $$begin raise exception'CONTROLLED_EXTRACTION_LAUNCH_IMMUTABLE';end$$;
create trigger controlled_extraction_launch_no_delete before delete on public.guidebook_controlled_extraction_launches for each row execute function public.prevent_controlled_extraction_launch_delete();
