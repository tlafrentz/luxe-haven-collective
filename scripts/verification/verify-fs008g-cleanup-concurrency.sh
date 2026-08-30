#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"
container="supabase_db_luxe-haven-collective"
psql_local() { docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1; }

psql_local < scripts/verification/fs008g-cleanup-concurrency-prepare.sql
result_dir="$(mktemp -d)"
docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/verification/fs008g-cleanup-concurrency-dependency.sql > "${result_dir}/dependency.log" 2>&1 &
dependency_pid=$!
sleep 1
set +e
docker exec -i "${container}" psql -U postgres -d postgres < scripts/verification/fs008g-cleanup-concurrency-cleanup.sql > "${result_dir}/cleanup.log" 2>&1
cleanup_status=$?
set -e
wait "${dependency_pid}"
if ! rg -q "CLEANUP_NOTIFICATION_DEPENDENCY" "${result_dir}/cleanup.log"; then
  sed -n '1,160p' "${result_dir}/cleanup.log"
  exit 1
fi
psql_local < scripts/verification/fs008g-cleanup-concurrency-assert.sql
