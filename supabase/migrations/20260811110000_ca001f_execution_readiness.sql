-- CA-001F execution-readiness definitions. Registration remains an actor-authorized server operation.
alter table public.production_verification_plans add column fingerprint text not null default '';
alter table public.production_verification_scenarios add column fingerprint text not null default '';
alter table public.production_verification_evidence_definitions add column fingerprint text not null default '';
alter table public.production_verification_plans add column registered_by uuid references public.profiles(id);
alter table public.production_verification_scenarios add column registered_by uuid references public.profiles(id);
alter table public.production_verification_evidence_definitions add column registered_by uuid references public.profiles(id);
create table public.production_verification_policy_definitions(id uuid primary key default gen_random_uuid(),kind text not null check(kind in('retry_policy','timeout_policy','cleanup_policy','gate_policy','manual_observation')),code text not null,version integer not null check(version>0),status text not null check(status in('draft','active','retired')),fingerprint text not null,definition jsonb not null,published_at timestamptz,registered_by uuid not null references public.profiles(id),unique(kind,code,version));
create function public.prevent_published_verification_definition_mutation()returns trigger language plpgsql set search_path='' as $$begin if old.status='active'then raise exception'Published verification definitions are immutable';end if;return new;end$$;
create trigger production_verification_plans_immutable before update or delete on public.production_verification_plans for each row execute function public.prevent_published_verification_definition_mutation();
create trigger production_verification_scenarios_immutable before update or delete on public.production_verification_scenarios for each row execute function public.prevent_published_verification_definition_mutation();
create trigger production_verification_evidence_definitions_immutable before update or delete on public.production_verification_evidence_definitions for each row execute function public.prevent_published_verification_definition_mutation();
create trigger production_verification_policies_immutable before update or delete on public.production_verification_policy_definitions for each row execute function public.prevent_published_verification_definition_mutation();
alter table public.production_verification_policy_definitions enable row level security;
create policy "admins read verification policies" on public.production_verification_policy_definitions for select to authenticated using(public.is_admin());
revoke all on public.production_verification_policy_definitions from anon,authenticated;
grant select on public.production_verification_policy_definitions to authenticated;
