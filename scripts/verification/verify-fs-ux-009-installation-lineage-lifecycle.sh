#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"
container="supabase_db_luxe-haven-collective"
psql_local() { docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1; }

{
  printf '\\set FSUX7_CONTINUE 1\n'
  cat scripts/verification/fs-ux-006-database-matrix.sql
  cat <<'SQL'
update public.furnishing_procurement_baselines baseline
set current_readiness_version_id=snapshot.readiness_version_id,
    readiness_status='approved'
from public.fsux6_readiness_snapshots snapshot
where snapshot.baseline_id=baseline.id;
update public.fsux6_procurement_versions version
set state='approved'
from public.fsux6_readiness_snapshots snapshot
where snapshot.readiness_version_id=version.id;

do $$
declare baseline public.furnishing_procurement_baselines;
  line public.furnishing_procurement_lines;snapshot_id uuid;item_id uuid;
begin
  select value.* into baseline from public.furnishing_procurement_baselines value order by value.created_at desc limit 1;
  select value.* into line from public.furnishing_procurement_lines value where value.readiness_version_id=baseline.current_readiness_version_id limit 1;
  insert into public.fs008d_project_catalog_snapshots(project_id,tenant_id,package_version_id,snapshot,content_hash,correlation_id)
  values(baseline.project_id,baseline.workspace_id,gen_random_uuid(),'{}','fsux9-installation-native','fsux9-installation-native') returning id into snapshot_id;
  insert into public.fs008d_snapshot_items(snapshot_id,tenant_id,project_id,stable_item_id,room_id,product_id,retailer_offer_id,quantity,observed_price_minor,extended_product_cost_minor,delivery_minor,currency,required,selection_state,source_lineage,content_hash)
  values(snapshot_id,baseline.workspace_id,baseline.project_id,'fsux9-native',line.room_id,line.product_id,line.selected_offer_id,line.planned_quantity,line.estimated_unit_cost_minor,line.estimated_line_cost_minor,0,line.currency,true,'preferred','{}','fsux9-native-item') returning id into item_id;
  update public.furnishing_procurement_baselines
  set source_kind='catalog_snapshot',source_plan_id=null,source_catalog_snapshot_id=snapshot_id,
      fsux5_handoff_id=null,source_design_snapshot_id=null,source_budget_id=null
  where id=baseline.id;
  update public.furnishing_procurement_lines set source_line_kind='snapshot_item',source_plan_line_id=null,source_snapshot_item_id=item_id where id=line.id;
end$$;
SQL
  cat scripts/verification/fs-ux-007-database-matrix.sql
} | psql_local

printf "%s\n" "insert into public.ps001d_verification_tenants(tenant_id,designation,status,approved_by,expires_at,relationship_attestation) values('20000000-0000-4000-8000-000000000001','PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved','10000000-0000-4000-8000-000000000001',now()+interval '2 hours','{\"catalog\":false,\"payment\":false,\"customer\":false,\"provider\":false,\"automation\":false,\"publication\":false}'::jsonb) on conflict(tenant_id) do update set designation=excluded.designation,status=excluded.status,approved_by=excluded.approved_by,expires_at=excluded.expires_at,revoked_at=null,relationship_attestation=excluded.relationship_attestation;" | psql_local
printf "%s\n" "update public.furnishing_activation_releases set global_state='internal',global_kill_switch=false,configuration_valid=true where milestone='FS-008A';" | psql_local
psql_local < scripts/verification/fs-ux-007-cleanup-matrix.sql
printf "%s\n" "update public.furnishing_activation_releases set global_state='disabled',global_kill_switch=true,configuration_valid=false,optimistic_version=1 where milestone='FS-008A';" | psql_local
printf "%s\n" "delete from public.ps001d_verification_tenants where tenant_id='20000000-0000-4000-8000-000000000001';" | psql_local

printf '%s\n' 'FS_UX_009_INSTALLATION_LINEAGE_LIFECYCLE_PASS'
