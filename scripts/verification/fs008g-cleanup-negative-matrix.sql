\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role','service_role',true);

create or replace function pg_temp.fs008g_fixture(p_tag text) returns jsonb language plpgsql as $$
declare designation jsonb;bound jsonb;designation_id uuid;run_id uuid:=gen_random_uuid();correlation uuid:=gen_random_uuid();account_id uuid:=gen_random_uuid();property_id uuid:=gen_random_uuid();project_id uuid:=gen_random_uuid();plan_id uuid:=gen_random_uuid();
begin
 designation:=public.designate_fs008g_controlled_project(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','controlled_run_id',run_id,'correlation_id',correlation,'candidate_commit','fs008g-local-candidate','purpose','Cleanup negative matrix '||p_tag,'created_by','10000000-0000-4000-8000-000000000001','expires_at',now()+interval '2 hours'));
 designation_id:=(designation->>'designationId')::uuid;
 insert into public.customer_accounts(id,tenant_id,account_type,status) values(account_id,'20000000-0000-4000-8000-000000000001','owner','active');
 insert into public.customer_account_memberships(tenant_id,customer_account_id,profile_id,status) values('20000000-0000-4000-8000-000000000001',account_id,'10000000-0000-4000-8000-000000000001','active');
 insert into public.properties(id,owner_id,name,slug,description,city,state,status,source) values(property_id,'20000000-0000-4000-8000-000000000001','FS008G C8 Isolated Property '||p_tag,'fs008g-'||replace(project_id::text,'-',''),'Controlled cleanup fixture','Austin','TX','draft','manual');
 insert into public.furnishing_projects(id,property_id,workspace_id,name,created_by,lifecycle_status) values(project_id,property_id,'20000000-0000-4000-8000-000000000001','C8-D Isolated Furnishing Lifecycle '||p_tag,'10000000-0000-4000-8000-000000000001','draft');
 insert into public.furnishing_plans(id,project_id,version_number,status,created_by) values(plan_id,project_id,1,'draft','10000000-0000-4000-8000-000000000001');
 bound:=public.bind_fs008g_controlled_project(jsonb_build_object('designation_id',designation_id,'project_id',project_id,'customer_account_id',account_id,'property_id',property_id,'controlled_run_id',run_id,'correlation_id',correlation,'created_by','10000000-0000-4000-8000-000000000001','candidate_commit','fs008g-local-candidate'));
 return jsonb_build_object('designationId',designation_id,'runId',run_id,'correlationId',correlation,'accountId',account_id,'propertyId',property_id,'projectId',project_id,'planId',plan_id);
end$$;

create or replace function pg_temp.fs008g_cleanup_command(p_fixture jsonb,p_suffix text default '') returns jsonb language sql as $$
 select jsonb_build_object('designation_id',p_fixture->>'designationId','project_id',p_fixture->>'projectId','workspace_id','20000000-0000-4000-8000-000000000001','controlled_run_id',p_fixture->>'runId','correlation_id',p_fixture->>'correlationId','actor_id','10000000-0000-4000-8000-000000000001','candidate_commit','fs008g-local-candidate','reason','Cleanup negative matrix','idempotency_key','cleanup-negative-'||(p_fixture->>'runId')||p_suffix)
$$;

do $$declare failure text;begin
 begin perform public.cleanup_fs008g_synthetic_project(jsonb_build_object('designation_id',gen_random_uuid(),'project_id',gen_random_uuid(),'workspace_id','20000000-0000-4000-8000-000000000001','controlled_run_id',gen_random_uuid(),'correlation_id',gen_random_uuid(),'actor_id','10000000-0000-4000-8000-000000000001','candidate_commit','fs008g-local-candidate','reason','Missing designation denial','idempotency_key','missing-designation-denial'));raise exception 'EXPECTED_CLEANUP_DENIAL';exception when others then failure:=sqlerrm;if failure='EXPECTED_CLEANUP_DENIAL' then raise;end if;end;
 if exists(select 1 from public.furnishing_cleanup_runs where idempotency_key='missing-designation-denial') then raise exception 'MISSING_DESIGNATION_MUTATED';end if;
end$$;

do $$declare designation jsonb;run_id uuid:=gen_random_uuid();correlation uuid:=gen_random_uuid();property_id uuid:=gen_random_uuid();project_id uuid:=gen_random_uuid();account_id uuid:=gen_random_uuid();failure text;begin
 begin
  insert into public.properties(id,owner_id,name,slug,description,city,state,status,source,created_at) values(property_id,'20000000-0000-4000-8000-000000000001','FS008G C8 Isolated Property preexisting','fs008g-preexisting-'||replace(project_id::text,'-',''),'Preexisting project denial','Austin','TX','draft','manual',now()-interval '1 hour');
  insert into public.furnishing_projects(id,property_id,workspace_id,name,created_by,lifecycle_status,created_at) values(project_id,property_id,'20000000-0000-4000-8000-000000000001','C8-D Isolated Furnishing Lifecycle preexisting','10000000-0000-4000-8000-000000000001','draft',now()-interval '1 hour');
  designation:=public.designate_fs008g_controlled_project(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','controlled_run_id',run_id,'correlation_id',correlation,'candidate_commit','fs008g-local-candidate','purpose','Preexisting binding denial','created_by','10000000-0000-4000-8000-000000000001','expires_at',now()+interval '2 hours'));
  insert into public.customer_accounts(id,tenant_id,account_type,status) values(account_id,'20000000-0000-4000-8000-000000000001','owner','active');
  insert into public.customer_account_memberships(tenant_id,customer_account_id,profile_id,status) values('20000000-0000-4000-8000-000000000001',account_id,'10000000-0000-4000-8000-000000000001','active');
  begin perform public.bind_fs008g_controlled_project(jsonb_build_object('designation_id',designation->>'designationId','project_id',project_id,'customer_account_id',account_id,'property_id',property_id,'controlled_run_id',run_id,'correlation_id',correlation,'created_by','10000000-0000-4000-8000-000000000001','candidate_commit','fs008g-local-candidate'));raise exception 'EXPECTED_BIND_DENIAL';exception when others then failure:=sqlerrm;if failure='EXPECTED_BIND_DENIAL' then raise;end if;end;
  raise exception 'ROLLBACK_SCENARIO';
 exception when others then if sqlerrm<>'ROLLBACK_SCENARIO' then raise;end if;end;
end$$;

do $$declare scenario text;f jsonb;command jsonb;baseline_id uuid;commerce_customer text;commerce_order text;failure text;begin
 foreach scenario in array array['customer','notification','payment','retailer_order','procurement','installation'] loop
  begin
   f:=pg_temp.fs008g_fixture(scenario);command:=pg_temp.fs008g_cleanup_command(f);
   if scenario='customer' then
    insert into public.customer_accounts(tenant_id,account_type,status) values('20000000-0000-4000-8000-000000000001','owner','active');
   elsif scenario='notification' then
    insert into public.notifications(workspace_id,recipient_profile_id,category,event_type,urgency,subject_type,subject_id,title,body,status,required,deduplication_key) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','operations','fixture_dependency','informational','furnishing_project',f->>'projectId','Fixture dependency','Must block cleanup','unread',false,'cleanup-'||(f->>'runId'));
   elsif scenario='payment' then
    commerce_customer:='cus_'||replace((f->>'runId'),'-','');commerce_order:='ord_'||replace((f->>'runId'),'-','');
    insert into public.commerce_customers(id,workspace_id,email,status,created_at) values(commerce_customer,'20000000-0000-4000-8000-000000000001','fixture@example.invalid','active',now());
    insert into public.commerce_orders(id,order_number,customer_id,workspace_id,status,currency,subtotal_minor,total_minor,created_at,updated_at) values(commerce_order,'ORDER-'||left(f->>'runId',8),commerce_customer,'20000000-0000-4000-8000-000000000001','draft','USD',100,100,now(),now());
    insert into public.commerce_payments(id,order_id,customer_id,workspace_id,provider,environment,amount_minor,currency,status,attempt_number) values('pay_'||replace((f->>'runId'),'-',''),commerce_order,commerce_customer,'20000000-0000-4000-8000-000000000001','stripe','test',100,'USD','pending',1);
   elsif scenario='retailer_order' then
    insert into public.furnishing_procurement_orders(project_id,workspace_id,po_number,vendor,status,external_order_id,order_type,currency,created_at,updated_at) values((f->>'projectId')::uuid,'20000000-0000-4000-8000-000000000001','PO-'||left(f->>'runId',8),'Controlled retailer','ordered','provider-'||(f->>'runId'),'external','USD',now(),now());
   else
    baseline_id:=gen_random_uuid();
    insert into public.furnishing_procurement_baselines(id,workspace_id,property_id,project_id,source_plan_id,source_plan_version,source_snapshot,source_hash,currency,status,idempotency_key,created_by) values(baseline_id,'20000000-0000-4000-8000-000000000001',(f->>'propertyId')::uuid,(f->>'projectId')::uuid,(f->>'planId')::uuid,1,'{}','fixture','USD','draft','baseline-'||(f->>'runId'),'10000000-0000-4000-8000-000000000001');
    if scenario='procurement' then insert into public.furnishing_procurement_exceptions(baseline_id,exception_type,severity,status) values(baseline_id,'controlled_dependency','blocking','open');
    else insert into public.furnishing_installation_projects(workspace_id,property_id,project_id,procurement_baseline_id,status,timezone,source_snapshot,source_hash,idempotency_key,created_by) values('20000000-0000-4000-8000-000000000001',(f->>'propertyId')::uuid,(f->>'projectId')::uuid,baseline_id,'planning','America/Chicago','{}','fixture','installation-'||(f->>'runId'),'10000000-0000-4000-8000-000000000001');end if;
   end if;
   begin perform public.cleanup_fs008g_synthetic_project(command);raise exception 'EXPECTED_CLEANUP_DENIAL';exception when others then failure:=sqlerrm;if failure='EXPECTED_CLEANUP_DENIAL' then raise;end if;end;
   if (select lifecycle_status from public.furnishing_projects where id=(f->>'projectId')::uuid)<>'draft' or (select status from public.furnishing_plans where id=(f->>'planId')::uuid)<>'draft' or exists(select 1 from public.furnishing_cleanup_runs where project_id=(f->>'projectId')::uuid) then raise exception 'CLEANUP_DENIAL_MUTATED:%',scenario;end if;
   raise exception 'ROLLBACK_SCENARIO';
  exception when others then if sqlerrm<>'ROLLBACK_SCENARIO' then raise;end if;end;
 end loop;
end$$;

do $$declare f jsonb;command jsonb;variant jsonb;failure text;scenario text;begin
 foreach scenario in array array['expired','revoked','wrong_candidate','wrong_run','wrong_correlation','wrong_workspace','wrong_creator'] loop
  begin
   f:=pg_temp.fs008g_fixture(scenario);command:=pg_temp.fs008g_cleanup_command(f);variant:=command;
   if scenario='expired' then update public.furnishing_controlled_fixture_designations set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where id=(f->>'designationId')::uuid;
   elsif scenario='revoked' then update public.furnishing_controlled_fixture_designations set revoked_at=now() where id=(f->>'designationId')::uuid;
   elsif scenario='wrong_candidate' then variant:=jsonb_set(variant,'{candidate_commit}','"wrong-candidate"');
   elsif scenario='wrong_run' then variant:=jsonb_set(variant,'{controlled_run_id}',to_jsonb(gen_random_uuid()::text));
   elsif scenario='wrong_correlation' then variant:=jsonb_set(variant,'{correlation_id}',to_jsonb(gen_random_uuid()::text));
   elsif scenario='wrong_workspace' then variant:=jsonb_set(variant,'{workspace_id}','"20000000-0000-4000-8000-000000000002"');
   else variant:=jsonb_set(variant,'{actor_id}','"10000000-0000-4000-8000-000000000002"');end if;
   begin perform public.cleanup_fs008g_synthetic_project(variant);raise exception 'EXPECTED_CLEANUP_DENIAL';exception when others then failure:=sqlerrm;if failure='EXPECTED_CLEANUP_DENIAL' then raise;end if;end;
   if (select lifecycle_status from public.furnishing_projects where id=(f->>'projectId')::uuid)<>'draft' or exists(select 1 from public.furnishing_cleanup_runs where project_id=(f->>'projectId')::uuid) then raise exception 'CLEANUP_MISMATCH_MUTATED:%',scenario;end if;
   raise exception 'ROLLBACK_SCENARIO';
  exception when others then if sqlerrm<>'ROLLBACK_SCENARIO' then raise;end if;end;
 end loop;
end$$;

do $$declare f jsonb;command jsonb;cleaned jsonb;replay jsonb;manifest jsonb;begin
 f:=pg_temp.fs008g_fixture('success');command:=pg_temp.fs008g_cleanup_command(f);
 cleaned:=public.cleanup_fs008g_synthetic_project(command);replay:=public.cleanup_fs008g_synthetic_project(command);manifest:=cleaned->'reconciliation'->'archivedCounts';
 if cleaned->>'status'<>'clean' or replay->>'status'<>'already_cleaned' or replay->>'id'<>cleaned->>'id' or replay->'reconciliation' is distinct from cleaned->'reconciliation' then raise exception 'CLEANUP_REPLAY_MISMATCH';end if;
 if (manifest->>'plans')::int<>1 or (manifest->>'projects')::int<>1 or (select lifecycle_status from public.furnishing_projects where id=(f->>'projectId')::uuid)<>'archived' or (select status from public.furnishing_plans where id=(f->>'planId')::uuid)<>'superseded' then raise exception 'CLEANUP_MANIFEST_MISMATCH';end if;
 if not exists(select 1 from public.furnishing_controlled_fixture_designations where id=(f->>'designationId')::uuid and cleaned_at is not null and revoked_at is not null) or not exists(select 1 from public.furnishing_cleanup_runs where id=(cleaned->>'id')::uuid) then raise exception 'CLEANUP_EVIDENCE_MISSING';end if;
 begin perform public.bind_fs008g_controlled_project(jsonb_build_object('designation_id',f->>'designationId','project_id',f->>'projectId','customer_account_id',f->>'accountId','property_id',f->>'propertyId','controlled_run_id',f->>'runId','correlation_id',f->>'correlationId','created_by','10000000-0000-4000-8000-000000000001','candidate_commit','fs008g-local-candidate'));raise exception 'DESIGNATION_REUSE_ALLOWED';exception when others then if sqlerrm='DESIGNATION_REUSE_ALLOWED' then raise;end if;end;
end$$;

do $$declare command jsonb:='{}'::jsonb;begin
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin perform public.cleanup_fs008g_synthetic_project(command);raise exception 'AUTHENTICATED_CLEANUP_ALLOWED';exception when insufficient_privilege then null;when others then if sqlerrm not like '%FS008G_FIXTURE_SERVICE_ROLE_REQUIRED%' then raise;end if;end;
 perform set_config('request.jwt.claim.role','anon',true);
 begin perform public.cleanup_fs008g_synthetic_project(command);raise exception 'ANON_CLEANUP_ALLOWED';exception when insufficient_privilege then null;when others then if sqlerrm not like '%FS008G_FIXTURE_SERVICE_ROLE_REQUIRED%' then raise;end if;end;
 perform set_config('request.jwt.claim.role','service_role',true);
end$$;
commit;
select 'FS008G_CLEANUP_NEGATIVE_MATRIX_PASS' as result;
