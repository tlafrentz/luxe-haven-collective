#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"
container="supabase_db_luxe-haven-collective"
psql_local() { docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1; }
tmp_dir="$(mktemp -d)"
trap 'rm -r "${tmp_dir}"' EXIT

psql_local < scripts/verification/fs008g-identity-concurrency-prepare.sql
psql_local < scripts/verification/fs008g-identity-concurrency-manual.sql > "${tmp_dir}/manual.out" 2>&1 &
manual_pid=$!
sleep 0.25
set +e
psql_local < scripts/verification/fs008g-identity-concurrency-adoption-conflict.sql > "${tmp_dir}/conflict.out" 2>&1
conflict_status=$?
set -e
wait "${manual_pid}"
if [[ ${conflict_status} -eq 0 ]] || ! rg -q "CATALOG_WORKSPACE_IDENTITY_CONFLICT" "${tmp_dir}/conflict.out"; then
  sed -n '1,120p' "${tmp_dir}/conflict.out"
  exit 1
fi

psql_local < scripts/verification/fs008g-identity-concurrency-adoption-a.sql > "${tmp_dir}/adoption-a.out" 2>&1 &
adoption_pid=$!
sleep 0.25
psql_local < scripts/verification/fs008g-identity-concurrency-adoption-b.sql > "${tmp_dir}/adoption-b.out" 2>&1
wait "${adoption_pid}"
rg -q '"status": "adopted"' "${tmp_dir}/adoption-a.out"
rg -q '"status": "existing"' "${tmp_dir}/adoption-b.out"
psql_local < scripts/verification/fs008g-identity-concurrency-assert.sql
