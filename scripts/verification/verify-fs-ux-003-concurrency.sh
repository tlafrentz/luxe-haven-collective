#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)";cd "${repo_root}";container="supabase_db_luxe-haven-collective";tmp_dir="$(mktemp -d)";trap 'rm -r "${tmp_dir}"' EXIT
psql_local(){ docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1; }
psql_local < scripts/verification/fs-ux-003-concurrency-prepare.sql
psql_local < scripts/verification/fs-ux-003-concurrency-a.sql > "${tmp_dir}/a.log" 2>&1 & a_pid=$!;sleep 0.25
psql_local < scripts/verification/fs-ux-003-concurrency-b.sql > "${tmp_dir}/b.log" 2>&1;wait "${a_pid}"
rg -q '"status": "complete"' "${tmp_dir}/a.log";rg -q '"status": "replayed"' "${tmp_dir}/b.log"
psql_local < scripts/verification/fs-ux-003-concurrency-assert.sql
