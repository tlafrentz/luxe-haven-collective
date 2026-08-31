#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"
container="supabase_db_luxe-haven-collective"
psql_local() { docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1; }

supabase db reset --local --version 20260829010000 --no-seed
psql_local < scripts/verification/fs008g-production-ceiling-seed.sql
for migration in \
  supabase/migrations/20260829020000_fs008g_c8a_catalog_package_governance.sql \
  supabase/migrations/20260829030000_fs008g_c8b_owner_selection_snapshot.sql \
  supabase/migrations/20260829040000_fs008g_c8c_procurement_cleanup.sql \
  supabase/migrations/20260829050000_fs008g_c8d_workspace_native_import.sql \
  supabase/migrations/20260829051000_fs008g_c8d_requirement_review_state.sql \
  supabase/migrations/20260830090000_fs_ux_002_catalog_lifecycle.sql \
  supabase/migrations/20260830100000_fs_ux_003_inventory_import_workflow.sql \
  supabase/migrations/20260830110000_fs_ux_004_room_packages.sql \
  supabase/migrations/20260830120000_fs_ux_005_design_workspaces_budgets.sql
do
  psql_local < "${migration}"
done
psql_local < scripts/verification/fs008g-production-ceiling-assert.sql
psql_local < scripts/verification/fs008g-identity-negative-matrix.sql
psql_local < scripts/verification/fs-ux-003-database-matrix.sql
psql_local < scripts/verification/fs-ux-004-database-matrix.sql
psql_local < scripts/verification/fs-ux-005-database-matrix.sql
