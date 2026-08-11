#!/usr/bin/env bash
set -euo pipefail

container_name="au001-rls-rehearsal"
postgres_password="au001-local-only"
repository_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
supabase_dir="${repository_dir}/supabase"

if [[ -n "${AU_REHEARSAL_DATABASE_URL:-}" ]]; then
  psql_bin="${PSQL_BIN:-/usr/local/opt/libpq/bin/psql}"
  if [[ ! -x "${psql_bin}" ]]; then
    echo "Hosted rehearsal requires psql at ${psql_bin}." >&2
    exit 1
  fi
  "${psql_bin}" "${AU_REHEARSAL_DATABASE_URL}" \
    -v ON_ERROR_STOP=1 \
    -f "${supabase_dir}/tests/au001_hosted_rehearsal.sql"
  exit 0
fi

cleanup() {
  docker stop "${container_name}" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

if docker ps -a --format '{{.Names}}' | grep -Fxq "${container_name}"; then
  echo "Refusing to reuse existing container ${container_name}." >&2
  exit 1
fi

docker run --rm -d \
  --name "${container_name}" \
  -e "POSTGRES_PASSWORD=${postgres_password}" \
  -v "${supabase_dir}:/work:ro" \
  postgres:17 >/dev/null

for _ in $(seq 1 30); do
  if docker exec "${container_name}" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "${container_name}" pg_isready -U postgres >/dev/null
docker exec "${container_name}" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /work/tests/au001c_governed_execution_rls.sql
