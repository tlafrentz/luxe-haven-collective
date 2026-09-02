\set ON_ERROR_STOP on
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fsux9-approval-owner@example.invalid',crypt('FSUX9-Approval!',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.profiles(id,email,full_name,role)
values('a1000000-0000-4000-8000-000000000001','fsux9-approval-owner@example.invalid','FSUX9 Approval Owner','owner')
on conflict(id) do update set full_name=excluded.full_name,role=excluded.role;
insert into public.owners(id,profile_id,company_name,display_name)
values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','FSUX9 Approval Workspace','FSUX9 Approval Workspace');
insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode,joined_at)
values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','owner','active','all',now());
insert into public.properties(id,owner_id,name,slug,description,city,state,property_type,timezone,source)
values('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','FSUX9 Approval Property','fsux9-approval-property','Controlled transaction proof','Austin','TX','home','America/Chicago','manual');
insert into public.furnishing_retailers(id,name,website_url,status)
values('a4000000-0000-4000-8000-000000000001','FSUX9 Manual Retailer','https://example.invalid','active');
insert into public.furnishing_products(id,workspace_id,name,product_type,category,status,scope,created_by,revision)
values('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','FSUX9 Approval Chair','catalog_item','Furniture','approved','workspace','a1000000-0000-4000-8000-000000000001',1);
insert into public.furnishing_product_versions(id,product_id,workspace_id,version,lifecycle_status,product_snapshot,correlation_id,idempotency_key,created_by,approved_by,approved_at)
values('a5000000-0000-4000-8000-000000000002','a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',1,'approved','{}','a5000000-0000-4000-8000-000000000090','fsux9-approval-product','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now());
insert into public.furnishing_product_offers(id,workspace_id,product_id,retailer_id,product_url,listed_price_minor,shipping_price_minor,currency,availability,last_verified_at,status,source_type)
values('a5000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','https://example.invalid/chair',25000,0,'USD','in_stock',now(),'active','manual');

update public.furnishing_activation_releases set global_state='internal',global_kill_switch=false,configuration_valid=true
where milestone='FS-008A';
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);

create function pg_temp.make_approval_project(p_name text) returns jsonb language plpgsql as $$
declare project_id uuid:=gen_random_uuid();plan_id uuid:=gen_random_uuid();room_id uuid:=gen_random_uuid();selection_id uuid:=gen_random_uuid();
begin
 insert into public.furnishing_projects(id,workspace_id,property_id,name,lifecycle_status,project_type,plan_status,design_workspace_status,target_budget_minor,optimistic_version,created_by)
 values(project_id,'a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',p_name,'awaiting_approval','full_property','awaiting_approval','customer_review',30000,1,'a1000000-0000-4000-8000-000000000001');
 insert into public.furnishing_plans(id,project_id,version_number,status,revision,estimated_subtotal_minor,estimated_shipping_minor,estimated_total_minor,currency,created_by)
 values(plan_id,project_id,1,'awaiting_approval',1,25000,0,25000,'USD','a1000000-0000-4000-8000-000000000001');
 update public.furnishing_projects set current_plan_version_id=plan_id where id=project_id;
 insert into public.furnishing_rooms(id,project_id,room_type,name,status,sort_order)
 values(room_id,project_id,'living_room','Living room','planning',0);
 insert into public.furnishing_product_selections(id,furnishing_plan_id,room_id,product_id,product_version_id,selected_offer_id,resolved_quantity,purchase_quantity,estimated_unit_price_minor,estimated_total_minor,currency,selection_source,selection_status,required,priority,sort_order)
 values(selection_id,plan_id,room_id,'a5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002','a5000000-0000-4000-8000-000000000003',1,1,25000,25000,'USD','manual','selected',true,'essential',0);
 insert into public.furnishing_selection_delivery_allocations(workspace_id,project_id,selection_id,property_id,quantity,delivery_minor,currency,created_by)
 values('a2000000-0000-4000-8000-000000000001',project_id,selection_id,'a3000000-0000-4000-8000-000000000001',1,0,'USD','a1000000-0000-4000-8000-000000000001');
 return jsonb_build_object('project',project_id,'plan',plan_id);
end$$;

do $$
declare fixture jsonb;result jsonb;approved_snapshot_id uuid;before_orders bigint;before_payments bigint;before_notifications bigint;failure text;
begin
 select count(*) into before_orders from public.furnishing_procurement_orders;
 select count(*) into before_payments from public.commerce_payments;
 select count(*) into before_notifications from public.notification_deliveries;
 fixture:=pg_temp.make_approval_project('FSUX9 customer approval happy path');
 result:=public.transition_furnishing_owner_plan(jsonb_build_object('plan_id',fixture->>'plan','expected_revision',1,'transition','approve','correlation_id',gen_random_uuid(),'idempotency_key','fsux9-approval-happy'));
 approved_snapshot_id:=(result->>'snapshotId')::uuid;
 if approved_snapshot_id is null or (select count(*) from public.fsux5_approval_snapshots where project_id=(fixture->>'project')::uuid)<>1 then raise exception 'APPROVAL_SNAPSHOT_COUNT';end if;
 if not exists(select 1 from public.furnishing_plans where id=(fixture->>'plan')::uuid and status='approved')then raise exception 'APPROVAL_PLAN_STATUS';end if;
 if not ((select value.snapshot from public.fsux5_approval_snapshots value where value.id=approved_snapshot_id)->'selections'->0 ? 'product_version') then raise exception 'APPROVAL_VERSION_EVIDENCE';end if;
 if public.transition_furnishing_owner_plan(jsonb_build_object('plan_id',fixture->>'plan','expected_revision',1,'transition','approve','correlation_id',(select correlation_id from public.furnishing_owner_plan_commands where idempotency_key='fsux9-approval-happy'),'idempotency_key','fsux9-approval-happy'))->>'status'<>'replayed' then raise exception 'APPROVAL_REPLAY';end if;
 perform public.fsux9_create_procurement_checklist((fixture->>'project')::uuid,2,'fsux9-approval-checklist');
 if (select count(*) from public.furnishing_simple_procurement_lines where project_id=(fixture->>'project')::uuid)<>1 then raise exception 'APPROVAL_CHECKLIST';end if;

 fixture:=pg_temp.make_approval_project('FSUX9 customer approval stale');
 begin perform public.transition_furnishing_owner_plan(jsonb_build_object('plan_id',fixture->>'plan','expected_revision',99,'transition','approve','correlation_id',gen_random_uuid(),'idempotency_key','fsux9-approval-stale'));raise exception 'STALE_ALLOWED';exception when others then failure:=sqlerrm;if failure not like '%OWNER_PLAN_STALE%' then raise;end if;end;
 if exists(select 1 from public.fsux5_approval_snapshots where project_id=(fixture->>'project')::uuid)then raise exception 'STALE_SNAPSHOT';end if;

 fixture:=pg_temp.make_approval_project('FSUX9 customer approval snapshot failure');
 perform set_config('fsux9.force_approval_snapshot_failure','on',true);
 begin perform public.transition_furnishing_owner_plan(jsonb_build_object('plan_id',fixture->>'plan','expected_revision',1,'transition','approve','correlation_id',gen_random_uuid(),'idempotency_key','fsux9-approval-snapshot-failure'));raise exception 'SNAPSHOT_FAILURE_ALLOWED';exception when others then failure:=sqlerrm;if failure not like '%OWNER_PLAN_SNAPSHOT_PERSISTENCE_FAILED%' then raise;end if;end;
 perform set_config('fsux9.force_approval_snapshot_failure','off',true);
 if not exists(select 1 from public.furnishing_plans where id=(fixture->>'plan')::uuid and status='awaiting_approval')or exists(select 1 from public.fsux5_approval_snapshots where project_id=(fixture->>'project')::uuid)then raise exception 'SNAPSHOT_FAILURE_NOT_ATOMIC';end if;

 fixture:=pg_temp.make_approval_project('FSUX9 customer approval audit failure');
 perform set_config('fsux9.force_approval_audit_failure','on',true);
 begin perform public.transition_furnishing_owner_plan(jsonb_build_object('plan_id',fixture->>'plan','expected_revision',1,'transition','approve','correlation_id',gen_random_uuid(),'idempotency_key','fsux9-approval-audit-failure'));raise exception 'AUDIT_FAILURE_ALLOWED';exception when others then failure:=sqlerrm;if failure not like '%OWNER_PLAN_AUDIT_PERSISTENCE_FAILED%' then raise;end if;end;
 perform set_config('fsux9.force_approval_audit_failure','off',true);
 if not exists(select 1 from public.furnishing_plans where id=(fixture->>'plan')::uuid and status='awaiting_approval')or exists(select 1 from public.fsux5_approval_snapshots where project_id=(fixture->>'project')::uuid)then raise exception 'AUDIT_FAILURE_NOT_ATOMIC';end if;

 if before_orders<>(select count(*) from public.furnishing_procurement_orders)or before_payments<>(select count(*) from public.commerce_payments)or before_notifications<>(select count(*) from public.notification_deliveries)then raise exception 'APPROVAL_EXTERNAL_EFFECT';end if;
end$$;

rollback;
select 'FS_UX_009_CUSTOMER_APPROVAL_PROCUREMENT_PASS' result;
