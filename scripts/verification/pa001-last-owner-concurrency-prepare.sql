\set ON_ERROR_STOP on
-- PA-001 AUTH-005 concurrency proof, part 1/4: seed a workspace with exactly
-- two active Workspace Owner role_assignments and one platform-admin actor
-- who will revoke them. Only an existing Owner or platform staff may revoke
-- an Owner assignment (mirrors the grant restriction), and self-revoke is
-- always blocked -- so a platform-admin actor is the only way to legitimately
-- reach "revoke the last remaining owner" without an owner revoking
-- themselves. Run against a throwaway local DB (supabase db reset between
-- runs) -- this script persists real rows, it does not roll back.

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,crypt('Local-PA001-Race-Only!',gen_salt('bf')),now(),'{}','{}',now(),now()
from (values
  ('c9010000-0000-4000-8000-000000000001'::uuid,'pa001-race-owner1@example.invalid'),
  ('c9010000-0000-4000-8000-000000000002'::uuid,'pa001-race-owner2@example.invalid'),
  ('c9010000-0000-4000-8000-000000000003'::uuid,'pa001-race-admin@example.invalid')
) fixture(id,email) on conflict(id) do nothing;

insert into public.profiles(id,email,full_name,role) values
('c9010000-0000-4000-8000-000000000001','pa001-race-owner1@example.invalid','PA001 Race Owner1','owner'),
('c9010000-0000-4000-8000-000000000002','pa001-race-owner2@example.invalid','PA001 Race Owner2','owner'),
('c9010000-0000-4000-8000-000000000003','pa001-race-admin@example.invalid','PA001 Race Admin','admin')
on conflict(id) do update set role=excluded.role;

insert into public.owners(id,profile_id) values
('d9010000-0000-4000-8000-000000000001','c9010000-0000-4000-8000-000000000001')
on conflict(id) do nothing;

insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode) values
('d9010000-0000-4000-8000-000000000001','c9010000-0000-4000-8000-000000000001','owner','active','all'),
('d9010000-0000-4000-8000-000000000001','c9010000-0000-4000-8000-000000000002','owner','active','all')
on conflict(workspace_id,profile_id) do nothing;

insert into public.role_assignments (id,subject_id,role_id,workspace_id,module,scope_type,assigner_id,reason,state)
select 'e9010000-0000-4000-8000-000000000001','c9010000-0000-4000-8000-000000000001',r.id,'d9010000-0000-4000-8000-000000000001',null,'workspace','c9010000-0000-4000-8000-000000000003','pa001 race fixture','active'
from public.roles r where r.canonical_name='workspace_owner'
on conflict (id) do nothing;

insert into public.role_assignments (id,subject_id,role_id,workspace_id,module,scope_type,assigner_id,reason,state)
select 'e9010000-0000-4000-8000-000000000002','c9010000-0000-4000-8000-000000000002',r.id,'d9010000-0000-4000-8000-000000000001',null,'workspace','c9010000-0000-4000-8000-000000000003','pa001 race fixture','active'
from public.roles r where r.canonical_name='workspace_owner'
on conflict (id) do nothing;

select 'PA-001 last-owner concurrency fixture prepared' as result;
