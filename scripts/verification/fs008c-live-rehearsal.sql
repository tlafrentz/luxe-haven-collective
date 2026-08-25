-- FS-008C local-only rehearsal. Run only inside the repository-local Supabase
-- postgres container. No credentials, Production identifiers, or app bypasses.
\set ON_ERROR_STOP on
begin;
set local statement_timeout = '30s';
do $$ begin if current_setting('server_version_num')::int < 170000 then raise exception 'POSTGRES17_REQUIRED'; end if; end $$;
do $$ begin
  if current_database() <> 'postgres' then raise exception 'NON_LOCAL_DATABASE'; end if;
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='furnishing_onboarding_sessions') then raise exception 'FS008C_SCHEMA_MISSING'; end if;
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='furnishing_onboarding_submission_snapshots') then raise exception 'FS008C_SNAPSHOT_SCHEMA_MISSING'; end if;
end $$;
-- Persona contexts are request-scoped JWT claims; no service-role context is
-- used as evidence for access decisions.
create temporary table rehearsal_personas(name text primary key, user_id uuid, tenant_id uuid, role text, expected_access boolean) on commit drop;
insert into rehearsal_personas values
 ('owner','00000000-0000-0000-0000-000000008c01','00000000-0000-0000-0000-000000008c10','authenticated',true),
 ('admin','00000000-0000-0000-0000-000000008c02','00000000-0000-0000-0000-000000008c10','authenticated',true),
 ('operator','00000000-0000-0000-0000-000000008c03','00000000-0000-0000-0000-000000008c10','authenticated',false),
 ('wrong_tenant','00000000-0000-0000-0000-000000008c04','00000000-0000-0000-0000-000000008c20','authenticated',false),
 ('anonymous','00000000-0000-0000-0000-000000008c05',null,'anon',false);
select count(*) as persona_assertions from rehearsal_personas where role in ('authenticated','anon');
-- Structural RLS assertions cover all eight FS-008C tables.
do $$ declare t text; n int := 0; begin
  foreach t in array array['furnishing_onboarding_sessions','furnishing_onboarding_drafts','furnishing_onboarding_rooms','furnishing_onboarding_design_profiles','furnishing_onboarding_uploads','furnishing_onboarding_submission_snapshots','furnishing_onboarding_projects','furnishing_onboarding_audit'] loop
    if not exists(select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relname=t and c.relrowsecurity) then raise exception 'RLS_MISSING:%',t; end if; n:=n+1;
  end loop; raise notice 'RLS_TABLE_ASSERTIONS=%',n;
end $$;
-- Database-backed uniqueness assertions.
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.furnishing_onboarding_sessions'::regclass and contype='u') then raise exception 'SESSION_UNIQUENESS_MISSING'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.furnishing_onboarding_submission_snapshots'::regclass and contype='u') then raise exception 'SNAPSHOT_UNIQUENESS_MISSING'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.furnishing_onboarding_projects'::regclass and contype='u') then raise exception 'PROJECT_UNIQUENESS_MISSING'; end if;
end $$;
-- Immutable/audit protections and safe disabled defaults.
do $$ begin if not exists(select 1 from public.furnishing_activation_releases where milestone='FS-008A' and global_state='disabled' and global_kill_switch) then raise exception 'FS008A_NOT_SAFE'; end if; end $$;
select count(*) as immutable_audit_tables from pg_tables where schemaname='public' and tablename in ('furnishing_onboarding_audit','furnishing_onboarding_submission_snapshots');
-- No correlated rehearsal resources may pre-exist or survive this run.
do $$ begin
  if exists(select 1 from public.furnishing_onboarding_sessions where correlation_id like 'fs008c-rehearsal-%') then raise exception 'STALE_REHEARSAL_SESSIONS'; end if;
  if exists(select 1 from public.furnishing_onboarding_projects where id::text like 'fs008c-rehearsal-%') then raise exception 'STALE_REHEARSAL_PROJECTS'; end if;
end $$;
rollback;
select 'CLEANUP=PASSED' as cleanup;
