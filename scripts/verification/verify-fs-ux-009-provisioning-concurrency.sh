#!/usr/bin/env bash
set -euo pipefail

container="supabase_db_luxe-haven-collective"
admin_id="99110000-0000-4000-8000-000000000001"
owner_id="99110000-0000-4000-8000-000000000002"
workspace_id="99110000-0000-4000-8000-000000000003"
run_dir="$(mktemp -d /tmp/fsux9-provisioning-race.XXXXXX)"
trap 'rm -rf "$run_dir"' EXIT

docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
delete from public.ps001d_verification_tenants where tenant_id='$workspace_id';
delete from public.owners where id='$workspace_id';
delete from auth.users where id in('$admin_id','$owner_id');
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('00000000-0000-0000-0000-000000000000','$admin_id','authenticated','authenticated','genuine-admin@example.com','',now(),'{}','{}',now(),now()),
 ('00000000-0000-0000-0000-000000000000','$owner_id','authenticated','authenticated','fs008g-c8-owner-$owner_id@example.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role='admin',email='genuine-admin@example.com' where id='$admin_id';
update public.profiles set role='owner',email='fs008g-c8-owner-$owner_id@example.invalid' where id='$owner_id';
insert into public.owners(id,profile_id,company_name) values('$workspace_id','$owner_id','FS008G C8 Concurrency Proof');
SQL

command="with configured as (select set_config('request.jwt.claim.role','service_role',true)) select provision_fs008g_c8_controlled_tenant('$workspace_id','$admin_id','$owner_id')->>'status' from configured;"
docker exec "$container" psql -U postgres -d postgres -Atc "$command" >"$run_dir/first" &
first_pid=$!
docker exec "$container" psql -U postgres -d postgres -Atc "$command" >"$run_dir/second" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

statuses="$(sort "$run_dir/first" "$run_dir/second" | tr '\n' ' ')"
test "$statuses" = "already_provisioned provisioned "
test "$(docker exec "$container" psql -U postgres -d postgres -Atc "select count(*) from public.ps001d_verification_tenants where tenant_id='$workspace_id'")" = "1"

docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
delete from public.ps001d_verification_tenants where tenant_id='$workspace_id';
delete from public.owners where id='$workspace_id';
delete from auth.users where id in('$admin_id','$owner_id');
SQL
echo FS_UX_009_PROVISIONING_CONCURRENCY_PASS
