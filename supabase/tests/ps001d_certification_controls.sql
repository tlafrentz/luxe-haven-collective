\set ON_ERROR_STOP on
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,crypt('Local-PS001D-Only!',gen_salt('bf')),now(),'{}','{}',now(),now()
from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid,'ps001d-admin@example.invalid'),
  ('d1000000-0000-4000-8000-000000000002'::uuid,'ps001d-owner@example.invalid'),
  ('d1000000-0000-4000-8000-000000000003'::uuid,'ps001d-operator@example.invalid'),
  ('d1000000-0000-4000-8000-000000000004'::uuid,'ps001d-wrong@example.invalid')
) fixture(id,email) on conflict(id) do nothing;

insert into public.profiles(id,email,full_name,role) values
('d1000000-0000-4000-8000-000000000001','ps001d-admin@example.invalid','PS001D Admin','admin'),
('d1000000-0000-4000-8000-000000000002','ps001d-owner@example.invalid','PS001D Owner','owner'),
('d1000000-0000-4000-8000-000000000003','ps001d-operator@example.invalid','PS001D Operator','owner'),
('d1000000-0000-4000-8000-000000000004','ps001d-wrong@example.invalid','PS001D Wrong Tenant','owner')
on conflict(id) do update set role=excluded.role;

insert into public.owners(id,profile_id,company_name,display_name) values
('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','PS001D Tenant','PS001D Tenant'),
('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000004','PS001D Wrong Tenant','PS001D Wrong Tenant')
on conflict(id) do nothing;

insert into public.workspace_memberships(id,workspace_id,profile_id,role,status,property_access_mode,joined_at) values
('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','owner','active','all',now()),
('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000003','operator','active','all',now()),
('d3000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000004','owner','active','all',now())
on conflict(workspace_id,profile_id) do update set role=excluded.role,status='active';

insert into public.ps001d_verification_tenants(tenant_id,designation,status,approved_by,expires_at,relationship_attestation) values
('d2000000-0000-4000-8000-000000000001','PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved','d1000000-0000-4000-8000-000000000001',now()+interval '1 day','{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}');

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);

select public.authorize_ps001d_verification_identity('d1000000-0000-4000-8000-000000000001','admin','d1000000-0000-4000-8000-000000000001','admin','d2000000-0000-4000-8000-000000000001','platform_admin',repeat('a',40),'dpl_localcandidate','ps001d-00000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour');
select public.authorize_ps001d_verification_identity('d1000000-0000-4000-8000-000000000001','authorized_operator','d1000000-0000-4000-8000-000000000003','operator','d2000000-0000-4000-8000-000000000001','active_member',repeat('a',40),'dpl_localcandidate','ps001d-00000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour');
select public.authorize_ps001d_verification_identity('d1000000-0000-4000-8000-000000000001','authorized_owner','d1000000-0000-4000-8000-000000000002','owner','d2000000-0000-4000-8000-000000000001','active_member',repeat('a',40),'dpl_localcandidate','ps001d-00000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour');
select public.authorize_ps001d_verification_identity('d1000000-0000-4000-8000-000000000001','wrong_tenant','d1000000-0000-4000-8000-000000000004','owner','d2000000-0000-4000-8000-000000000001','wrong_tenant',repeat('a',40),'dpl_localcandidate','ps001d-00000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour');
select public.authorize_ps001d_verification_identity('d1000000-0000-4000-8000-000000000001','anonymous',null,'anonymous','d2000000-0000-4000-8000-000000000001','unauthenticated',repeat('a',40),'dpl_localcandidate','ps001d-00000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()+interval '1 hour');

do $$ declare claim public.ps001d_verification_claims; property public.properties; booking public.bookings; cleanup jsonb; begin
  begin perform public.create_ps001d_verification_property('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','d9000000-0000-4000-8000-000000000001',repeat('a',40),'dpl_localcandidate','d2000000-0000-4000-8000-000000000001','ps001d-00000000-0000-4000-8000-000000000001'); raise exception 'preclaim fixture accepted'; exception when raise_exception then if sqlerrm<>'PS001D_CLAIM_BINDING_MISMATCH' then raise; end if; end;
  select * into claim from public.acquire_ps001d_verification_claim('d1000000-0000-4000-8000-000000000001',repeat('a',40),'dpl_localcandidate','d2000000-0000-4000-8000-000000000001','ps001d-00000000-0000-4000-8000-000000000001',now()+interval '1 hour');
  begin perform public.acquire_ps001d_verification_claim('d1000000-0000-4000-8000-000000000001',repeat('a',40),'dpl_localcandidate','d2000000-0000-4000-8000-000000000001','ps001d-00000000-0000-4000-8000-000000000001',now()+interval '1 hour'); raise exception 'replay accepted'; exception when raise_exception then if sqlerrm<>'PS001D_CLAIM_UNAVAILABLE' then raise; end if; end;
  begin perform public.consume_ps001d_verification_claim('d1000000-0000-4000-8000-000000000001',claim.id,repeat('b',40),'dpl_localcandidate','d2000000-0000-4000-8000-000000000001',claim.correlation_id); raise exception 'substitution accepted'; exception when raise_exception then if sqlerrm<>'PS001D_CLAIM_BINDING_MISMATCH' then raise; end if; end;
  perform public.consume_ps001d_verification_claim('d1000000-0000-4000-8000-000000000001',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id);
  begin perform public.consume_ps001d_verification_claim('d1000000-0000-4000-8000-000000000001',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id); raise exception 'consumed replay accepted'; exception when raise_exception then if sqlerrm<>'PS001D_CLAIM_NOT_CONSUMABLE' then raise; end if; end;
  select * into property from public.create_ps001d_verification_property('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id);
  if not property.ps001d_synthetic or property.status<>'draft' then raise exception 'property fixture marker missing'; end if;
  begin perform public.create_ps001d_verification_property('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id); raise exception 'duplicate property accepted'; exception when raise_exception then if sqlerrm<>'PS001D_FIXTURE_DUPLICATE' then raise; end if; end;
  begin perform public.create_ps001d_verification_booking('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000003',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id,'d4000000-0000-4000-8000-000000000099'); raise exception 'cross-tenant property accepted'; exception when raise_exception then if sqlerrm<>'PS001D_PROPERTY_SCOPE_MISMATCH' then raise; end if; end;
  select * into booking from public.create_ps001d_verification_booking('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000003',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id,property.id);
  if not booking.ps001d_synthetic or not booking.ps001d_side_effects_suppressed then raise exception 'booking fixture marker missing'; end if;
  if exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=claim.id and status<>'created') then raise exception 'fixture ledger not atomic'; end if;
  select public.cleanup_ps001d_verification_fixtures('d1000000-0000-4000-8000-000000000001',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id) into cleanup;
  if not (cleanup->>'resolved')::boolean then raise exception 'fixture cleanup incomplete'; end if;
  select public.cleanup_ps001d_verification_fixtures('d1000000-0000-4000-8000-000000000001',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id) into cleanup;
  if not (cleanup->>'resolved')::boolean then raise exception 'fixture cleanup replay failed'; end if;
  perform public.complete_ps001d_verification_claim('d1000000-0000-4000-8000-000000000001',claim.id,claim.candidate_commit,claim.deployment_id,claim.tenant_id,claim.correlation_id);
  if exists(select 1 from public.ps001d_verification_identity_authorizations where correlation_id=claim.correlation_id and revoked_at is null) then raise exception 'authorizations remained active'; end if;
  if (select status from public.ps001d_verification_claims where id=claim.id)<>'completed' then raise exception 'claim not completed'; end if;
end $$;

do $$ begin
  begin perform public.acquire_ps001d_verification_claim('d1000000-0000-4000-8000-000000000002',repeat('c',40),'dpl_unauthorized','d2000000-0000-4000-8000-000000000001','ps001d-00000000-0000-4000-8000-000000000002',now()+interval '1 hour'); raise exception 'non-admin acquired claim'; exception when raise_exception then if sqlerrm<>'PS001D_ADMIN_REQUIRED' then raise; end if; end;
end $$;

rollback;
select 'PS-001D certification controls PostgreSQL verification passed' as result;
