#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)";cd "${repo_root}"
container="supabase_db_luxe-haven-collective";tmp_dir="$(mktemp -d)";trap 'rm -rf "${tmp_dir}"' EXIT
psql_local(){ docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1; }
psql_local < scripts/verification/fs-ux-004-concurrency-prepare.sql
psql_local < scripts/verification/fs-ux-004-concurrency-a.sql > "${tmp_dir}/a.log" 2>&1 & a_pid=$!
sleep 0.25
docker exec -i "${container}" psql -U postgres -d postgres < scripts/verification/fs-ux-004-concurrency-b.sql > "${tmp_dir}/b.log" 2>&1 || true
wait "${a_pid}"
grep -q "ROOM_PACKAGE_VERSION_STALE_OR_NOT_EDITABLE" "${tmp_dir}/b.log"
psql_local < scripts/verification/fs-ux-004-concurrency-assert.sql
