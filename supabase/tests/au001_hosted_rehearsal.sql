\set ON_ERROR_STOP on

-- Hosted AU-001 rehearsal against the fully migrated Supabase schema. All
-- identifiers and email addresses are synthetic and isolated to the rehearsal
-- project.

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  email,crypt('Hosted-Rehearsal-Only-2026!',gen_salt('bf')),now(),
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid,'au-owner-1@example.invalid'),
  ('10000000-0000-0000-0000-000000000002'::uuid,'au-admin@example.invalid'),
  ('10000000-0000-0000-0000-000000000003'::uuid,'au-restricted@example.invalid'),
  ('10000000-0000-0000-0000-000000000004'::uuid,'au-owner-2@example.invalid')
) fixture(id,email)
on conflict(id) do nothing;

insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
select email,id,
  jsonb_build_object('sub',id::text,'email',email,'email_verified',true),
  'email',now(),now()
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid,'au-owner-1@example.invalid'),
  ('10000000-0000-0000-0000-000000000002'::uuid,'au-admin@example.invalid'),
  ('10000000-0000-0000-0000-000000000003'::uuid,'au-restricted@example.invalid'),
  ('10000000-0000-0000-0000-000000000004'::uuid,'au-owner-2@example.invalid')
) fixture(id,email)
on conflict(provider_id,provider) do update set
  user_id=excluded.user_id,identity_data=excluded.identity_data,updated_at=now();

update auth.users set
  confirmation_token=coalesce(confirmation_token,''),
  recovery_token=coalesce(recovery_token,''),
  email_change_token_new=coalesce(email_change_token_new,''),
  email_change=coalesce(email_change,'')
where id in(
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);

insert into public.profiles(id,email,full_name,role)
values
  ('10000000-0000-0000-0000-000000000001','au-owner-1@example.invalid','AU Owner One','owner'),
  ('10000000-0000-0000-0000-000000000002','au-admin@example.invalid','AU Administrator','admin'),
  ('10000000-0000-0000-0000-000000000003','au-restricted@example.invalid','AU Restricted Operator','cleaner'),
  ('10000000-0000-0000-0000-000000000004','au-owner-2@example.invalid','AU Owner Two','owner')
on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,role=excluded.role;

insert into public.owners(id,profile_id,company_name,display_name)
values
  ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','AU Rehearsal Tenant One','AU Rehearsal Tenant One'),
  ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','AU Rehearsal Tenant Two','AU Rehearsal Tenant Two')
on conflict(id) do update set profile_id=excluded.profile_id,company_name=excluded.company_name,display_name=excluded.display_name;

insert into public.properties(id,owner_id,name,slug,description,city,state,status,source,timezone)
values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','AU Property One','au-rehearsal-property-one','Synthetic rehearsal property','Austin','TX','active','manual','America/Chicago'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','AU Property Two','au-rehearsal-property-two','Synthetic restricted property','Austin','TX','active','manual','America/Chicago'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','AU Property Three','au-rehearsal-property-three','Synthetic cross-tenant property','Denver','CO','active','manual','America/Denver')
on conflict(id) do update set owner_id=excluded.owner_id,name=excluded.name;

insert into public.workspace_memberships(id,workspace_id,profile_id,role,status,property_access_mode,joined_at)
values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner','active','all',now()),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','administrator','active','all',now()),
  ('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','operator','active','selected',now()),
  ('40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','owner','active','all',now())
on conflict(workspace_id,profile_id) do update set role=excluded.role,status=excluded.status,property_access_mode=excluded.property_access_mode;

insert into public.workspace_member_property_access(membership_id,property_id)
values('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claim.role','authenticated',false);

select public.save_automation_definition(
  jsonb_build_object('id','hosted-automation-1','workspace_id','10000000-0000-0000-0000-000000000001','status','draft','current_version',1,'aggregate_version',1,'property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'created_by_profile_id','10000000-0000-0000-0000-000000000001','created_at','2026-08-10T12:00:00Z'),
  jsonb_build_object('id','hosted-automation-version-1','automation_id','hosted-automation-1','workspace_id','10000000-0000-0000-0000-000000000001','version',1,'name','Hosted arrival readiness','description','Synthetic hosted rehearsal.','status','draft','scope_type','property','property_ids',jsonb_build_array('30000000-0000-0000-0000-000000000001'),'owner_profile_id','10000000-0000-0000-0000-000000000001','trigger_specification','{}'::jsonb,'condition_specifications','[]'::jsonb,'exclusion_specifications','[]'::jsonb,'command_specification','{}'::jsonb,'approval_policy','{}'::jsonb,'execution_policy','{}'::jsonb,'retry_policy','{}'::jsonb,'notification_policy','{}'::jsonb,'effective_from','2026-08-10T12:00:00Z','schema_version','au001-definition.v1','policy_version','au001-foundation.v1','compatibility','compatible','created_by_profile_id','10000000-0000-0000-0000-000000000001','created_at','2026-08-10T12:00:00Z','reason','Hosted rehearsal'),
  jsonb_build_object('id','hosted-automation-activity-1','workspace_id','10000000-0000-0000-0000-000000000001','automation_id','hosted-automation-1','definition_version',1,'event_type','created','actor_profile_id','10000000-0000-0000-0000-000000000001','occurred_at','2026-08-10T12:00:00Z','correlation_id','hosted-correlation-1','safe_metadata','{}'::jsonb),
  jsonb_build_object('id','hosted-automation-notification-1','recipient_id','10000000-0000-0000-0000-000000000001','event_type','automation.created','safe_template_variables','{}'::jsonb,'idempotency_key','hosted-automation-1:created:1','created_at','2026-08-10T12:00:00Z'),
  null
)
where not exists(
  select 1 from public.automation_definitions where id='hosted-automation-1'
);

reset role;
set role service_role;
insert into public.automation_triggers(id,workspace_id,automation_id,automation_definition_version,kind,schema_version,scope_type,property_ids,enabled,effective_from,configuration,misfire_policy,backfill_maximum_count,backfill_maximum_age_ms,deduplication_policy_version,eligibility_policy_version,created_by_profile_id,updated_by_profile_id,created_at,updated_at,version)
values('hosted-trigger-1','10000000-0000-0000-0000-000000000001','hosted-automation-1',1,'MANUAL','au001-trigger.v1','property','{30000000-0000-0000-0000-000000000001}',false,'2026-01-01T00:00:00Z','{}','SKIP',10,604800000,'au001-occurrence.v1','au001-eligibility.v1','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2026-08-10T12:00:00Z','2026-08-10T12:00:00Z',1)
on conflict(id) do nothing;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$ begin
  if (select count(*) from public.automation_definitions where id='hosted-automation-1')<>1 then raise exception 'same-tenant owner cannot read definition'; end if;
  if (select count(*) from public.automation_triggers where id='hosted-trigger-1')<>1 then raise exception 'same-tenant owner cannot read trigger'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
do $$ begin if (select count(*) from public.automation_definitions where id='hosted-automation-1')<>1 then raise exception 'same-tenant administrator cannot read definition'; end if; end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
do $$ begin if (select count(*) from public.automation_definitions where id='hosted-automation-1')<>0 then raise exception 'cross-property definition leaked'; end if; end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
do $$ begin if (select count(*) from public.automation_definitions where id='hosted-automation-1')<>0 then raise exception 'cross-tenant definition leaked'; end if; end $$;

reset role;
set role anon;
do $$ begin if (select count(*) from public.automation_definitions)<>0 then raise exception 'anonymous definition leaked'; end if; end $$;

reset role;
set role service_role;
do $$ begin
  if (select count(*) from public.automation_definitions where id='hosted-automation-1')<>1 then raise exception 'service role cannot perform authorized read'; end if;
  begin update public.automation_definition_activity set event_type='tampered' where id='hosted-automation-activity-1'; raise exception 'append-only activity changed'; exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'AU-001 hosted PostgreSQL and RLS verification passed' as result;
