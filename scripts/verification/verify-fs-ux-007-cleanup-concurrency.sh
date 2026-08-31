#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"
container="supabase_db_luxe-haven-collective"
psql_local(){ docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1; }
{ cat scripts/verification/fs008g-cleanup-concurrency-prepare.sql; cat scripts/verification/fs-ux-007-cleanup-concurrency-prepare.sql; } | psql_local
result_dir="$(mktemp -d)"
docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/verification/fs-ux-007-cleanup-concurrency-dependency.sql > "${result_dir}/dependency.log" 2>&1 &
dependency_pid=$!
sleep 1
psql_local < scripts/verification/fs-ux-007-cleanup-concurrency-cleanup.sql > "${result_dir}/cleanup.log"
wait "${dependency_pid}"
psql_local < scripts/verification/fs-ux-007-cleanup-concurrency-assert.sql
