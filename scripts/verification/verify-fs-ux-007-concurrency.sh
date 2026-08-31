#!/usr/bin/env bash
set -euo pipefail

container="supabase_db_luxe-haven-collective"
psql_local() { docker exec -i "${container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At; }
auth="select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);"

existing="$(printf "select count(*) from public.furnishing_installation_projects where idempotency_key='fsux7-race-project';" | psql_local | tail -1)"
if [[ "${existing}" = "0" ]]; then
  { printf '\\set FSUX7_CONTINUE 1\n'; cat scripts/verification/fs-ux-006-database-matrix.sql; cat scripts/verification/fs-ux-007-concurrency-setup.sql; } | psql_local
fi
project_id="$(printf "select id from public.furnishing_installation_projects where idempotency_key='fsux7-race-project';" | psql_local | tail -1)"
order_line_id="$(printf "select ol.id from public.furnishing_procurement_order_lines ol join public.furnishing_procurement_orders o on o.id=ol.order_id where o.po_number='FSUX7-RACE-ORDER';" | psql_local | tail -1)"
planned_id="$(printf "select id from public.fsux7_planned_lines where installation_project_id='%s';" "${project_id}" | psql_local | tail -1)"
room_id="$(printf "select room_id from public.fsux7_planned_lines where id='%s';" "${planned_id}" | psql_local | tail -1)"

receipt_a="$(mktemp)"; receipt_b="$(mktemp)"; install_a="$(mktemp)"; install_b="$(mktemp)"; completion_a="$(mktemp)"; completion_b="$(mktemp)"
trap 'rm -f "${receipt_a}" "${receipt_b}" "${install_a}" "${install_b}" "${completion_a}" "${completion_b}"' EXIT

(printf "%s begin;select public.fsux7_record_receipt('%s',2,jsonb_build_object('order_line_id','%s','quantity',1,'evidence_class','controlled_test'),'receipt-race-a','receipt-race-a');select pg_sleep(2);commit;" "${auth}" "${project_id}" "${order_line_id}" | psql_local >"${receipt_a}" 2>&1) & first=$!
(printf "%s select pg_sleep(0.2);select public.fsux7_record_receipt('%s',2,jsonb_build_object('order_line_id','%s','quantity',1,'evidence_class','controlled_test'),'receipt-race-b','receipt-race-b');" "${auth}" "${project_id}" "${order_line_id}" | psql_local >"${receipt_b}" 2>&1) & second=$!
wait "${first}"; if wait "${second}"; then echo "receipt race unexpectedly had two winners" >&2; exit 1; fi
received="$(printf "select coalesce(sum(rl.quantity),0) from public.furnishing_procurement_receipt_lines rl where rl.procurement_line_id=(select procurement_line_id from public.fsux7_planned_lines where id='%s');" "${planned_id}" | psql_local | tail -1)"
test "${received}" = "1.0000"
grep -Eq 'INSTALLATION_TRACKING_STALE|RECEIPT_QUANTITY_EXCEEDED' "${receipt_b}"

(printf "%s begin;select public.fsux7_record_installation('%s',3,jsonb_build_object('planned_line_id','%s','quantity',1,'evidence_class','controlled_test','external_actor','Controlled installer A'),'install-race-a','install-race-a');select pg_sleep(2);commit;" "${auth}" "${project_id}" "${planned_id}" | psql_local >"${install_a}" 2>&1) & first=$!
(printf "%s select pg_sleep(0.2);select public.fsux7_record_installation('%s',3,jsonb_build_object('planned_line_id','%s','quantity',1,'evidence_class','controlled_test','external_actor','Controlled installer B'),'install-race-b','install-race-b');" "${auth}" "${project_id}" "${planned_id}" | psql_local >"${install_b}" 2>&1) & second=$!
wait "${first}"; if wait "${second}"; then echo "installation race unexpectedly had two winners" >&2; exit 1; fi
installed="$(printf "select coalesce(sum(quantity),0) from public.fsux7_installation_events where planned_line_id='%s';" "${planned_id}" | psql_local | tail -1)"
test "${installed}" = "1.0000"
grep -Eq 'INSTALLATION_TRACKING_STALE|INSTALLATION_QUANTITY_EXCEEDED' "${install_b}"

printf "%s select public.fsux7_record_inspection('%s',4,jsonb_build_object('planned_line_id','%s','room_id','%s','inspection_type','item','quantity',1,'result','passed','external_inspector','Controlled race inspector'),'race-item-inspection','race-item-inspection');select public.fsux7_record_inspection('%s',5,jsonb_build_object('room_id','%s','inspection_type','property','result','passed','external_inspector','Controlled race inspector'),'race-property-inspection','race-property-inspection');" "${auth}" "${project_id}" "${planned_id}" "${room_id}" "${project_id}" "${room_id}" | psql_local
(printf "%s begin;select public.fsux7_approve_completion('%s',6,'completion-race','completion-race');select pg_sleep(2);commit;" "${auth}" "${project_id}" | psql_local >"${completion_a}" 2>&1) & first=$!
(printf "%s select pg_sleep(0.2);select public.fsux7_approve_completion('%s',6,'completion-race','completion-race');" "${auth}" "${project_id}" | psql_local >"${completion_b}" 2>&1) & second=$!
wait "${first}"; wait "${second}"
snapshots="$(printf "select count(*) from public.fsux7_completion_snapshots where installation_project_id='%s';" "${project_id}" | psql_local | tail -1)"
test "${snapshots}" = "1"
grep -Eq '"idempotent"[[:space:]]*:[[:space:]]*true' "${completion_b}"
printf "FS_UX_007_RECEIPT_CONCURRENCY_PASS\nFS_UX_007_INSTALLATION_CONCURRENCY_PASS\nFS_UX_007_COMPLETION_CONCURRENCY_PASS\n"
