select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
#variable_conflict use_variable
declare snapshot_id uuid;project_id uuid;planned_id uuid;retailer_id uuid;result jsonb;
begin
 select s.id into snapshot_id from public.fsux6_readiness_snapshots s order by s.created_at desc limit 1;
 project_id:=(public.fsux7_create_project(snapshot_id,'fsux7-race-project','fsux7-race-project')->>'installation_project_id')::uuid;
 select p.id,p.retailer_id into planned_id,retailer_id from public.fsux7_planned_lines p where p.installation_project_id=project_id limit 1;
 result:=public.fsux7_record_order(project_id,1,jsonb_build_object('retailer_id',retailer_id,'planned_line_id',planned_id,'quantity',1,'external_order_number','FSUX7-RACE-ORDER','ordering_party','Controlled race purchaser','order_date','2026-08-30','evidence_class','controlled_test','unit_price_minor',100000,'order_total_minor',100000),'fsux7-race-order','fsux7-race-order');
end$$;
commit;
select 'FS_UX_007_CONCURRENCY_FIXTURE_PASS' as result;
