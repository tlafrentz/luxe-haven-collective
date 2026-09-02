\set ON_ERROR_STOP on
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fsux9-simplified-owner@example.invalid',crypt('Local-FSUX9-Simplified!',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.profiles(id,email,full_name,role)
values('10000000-0000-4000-8000-000000000001','fsux9-simplified-owner@example.invalid','FSUX9 Simplified Owner','owner')
on conflict(id) do update set role='owner',full_name=excluded.full_name;
insert into public.owners(id,profile_id,company_name,display_name)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','FSUX9 Simplified Workspace','FSUX9 Simplified Workspace')
on conflict(profile_id) do update set company_name=excluded.company_name,display_name=excluded.display_name;
insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode,joined_at)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner','active','all',now());
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
update public.furnishing_activation_releases set global_state='internal',global_kill_switch=false,configuration_valid=true where milestone='FS-008A';

insert into public.properties(id,owner_id,name,slug,description,city,state,bedrooms,bathrooms,max_guests,property_type,timezone,source,product_participation)
values('96500000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FSUX9 simplified property','fsux9-simplified-property','Controlled local fixture','Austin','TX',1,1,2,'home','America/Chicago','manual',array['furnishing_project']);
insert into public.furnishing_retailers(id,name,website_url,status)values('96500000-0000-4000-8000-000000000002','FSUX9 Manual Source','https://example.invalid','active');
insert into public.furnishing_products(id,workspace_id,name,product_type,category,status,scope,created_by,revision)values('96500000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','FSUX9 required chair','catalog_item','Furniture','approved','workspace','10000000-0000-4000-8000-000000000001',1);
insert into public.furnishing_product_versions(id,product_id,workspace_id,version,lifecycle_status,product_snapshot,correlation_id,idempotency_key,created_by,approved_by,approved_at)values('96500000-0000-4000-8000-000000000004','96500000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',1,'approved','{}','96500000-0000-4000-8000-000000000014','fsux9-simple-product','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',now());
insert into public.furnishing_product_offers(id,product_id,retailer_id,product_url,listed_price_minor,shipping_price_minor,currency,availability,last_verified_at,status)values('96500000-0000-4000-8000-000000000005','96500000-0000-4000-8000-000000000003','96500000-0000-4000-8000-000000000002','https://example.invalid/chair',25000,0,'USD','in_stock',now(),'active');

do $$
declare created jsonb;controlled_project_id uuid;design_version uuid;budget_id uuid;room_id uuid;customer_event uuid;approved jsonb;checklist jsonb;line public.furnishing_simple_procurement_lines;install public.furnishing_simple_installation_lines;before_orders bigint;before_payments bigint;before_notifications bigint;
begin
 select count(*) into before_orders from public.furnishing_procurement_orders;select count(*) into before_payments from public.commerce_payments;select count(*) into before_notifications from public.notification_deliveries;
 created:=public.fsux5_create_design_workspace('20000000-0000-4000-8000-000000000001','96500000-0000-4000-8000-000000000001','FSUX9 simplified lifecycle',null,'{}',jsonb_build_object('currency','USD','target_minimum_minor',20000,'target_maximum_minor',30000,'inclusion_basis','products_delivery'),'fsux9-simple-design','96500000-0000-4000-8000-000000000015');
 controlled_project_id:=(created->>'project_id')::uuid;design_version:=(created->>'design_version_id')::uuid;budget_id:=(created->>'budget_id')::uuid;
 insert into public.furnishing_rooms(project_id,design_version_id,room_type,name,sort_order,status)values(controlled_project_id,design_version,'living_room','Living room',0,'planning')returning id into room_id;
 insert into public.furnishing_product_selections(room_id,design_version_id,product_id,product_version_id,selected_offer_id,resolved_quantity,estimated_unit_price_minor,estimated_total_minor,currency,price_observed_at,selection_source,selection_status,required,priority,correlation_id)values(room_id,design_version,'96500000-0000-4000-8000-000000000003','96500000-0000-4000-8000-000000000004','96500000-0000-4000-8000-000000000005',1,25000,25000,'USD',now(),'manual','approved',true,'essential','96500000-0000-4000-8000-000000000016');
 update public.fsux5_design_versions set state='customer_review' where id=design_version;update public.furnishing_budgets set lifecycle_status='customer_review',product_subtotal_minor=25000,estimated_total_minor=25000 where id=budget_id;
 insert into public.fsux5_review_events(project_id,design_version_id,budget_id,stage,decision,customer_identity,recording_actor,correlation_id,idempotency_key)values(controlled_project_id,design_version,budget_id,'customer','approved','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fsux9-simple-review','fsux9-simple-review')returning id into customer_event;
 approved:=public.fsux5_approve_design(controlled_project_id,1,customer_event,'fsux9-simple-approval','fsux9-simple-approval');
 checklist:=public.fsux9_create_procurement_checklist(controlled_project_id,2,'fsux9-simple-checklist');
 if checklist->>'lineCount'<>'1' or checklist->>'externalEffects'<>'false' then raise exception 'SIMPLIFIED_CHECKLIST_FAILED %',checklist;end if;
 if public.fsux9_create_procurement_checklist(controlled_project_id,2,'fsux9-simple-checklist')->>'idempotent'<>'true' then raise exception 'SIMPLIFIED_REPLAY_FAILED';end if;
 begin perform public.fsux9_create_procurement_checklist(controlled_project_id,3,'fsux9-simple-checklist');raise exception 'SIMPLIFIED_CONFLICT_ALLOWED';exception when others then if sqlerrm not like '%FURNISHING_IDEMPOTENCY_CONFLICT%' then raise;end if;end;
 select value.* into line from public.furnishing_simple_procurement_lines value where value.project_id=controlled_project_id;
 perform public.fsux9_update_procurement_line(controlled_project_id,line.id,1,'ordered','Marked ordered manually','fsux9-simple-ordered');
 perform public.fsux9_start_installation(controlled_project_id,1,'fsux9-simple-installation');
 select value.* into install from public.furnishing_simple_installation_lines value where value.project_id=controlled_project_id;
 begin perform public.fsux9_complete_project(controlled_project_id,2,'fsux9-simple-premature');raise exception 'SIMPLIFIED_PREMATURE_COMPLETION';exception when others then if sqlerrm not like '%FURNISHING_REQUIRED_LINES_UNRESOLVED%' then raise;end if;end;
 begin perform public.fsux9_update_installation_line(controlled_project_id,install.id,99,1,1,'received','installed',null,null,false,'fsux9-simple-stale');raise exception 'SIMPLIFIED_STALE_ALLOWED';exception when others then if sqlerrm not like '%FURNISHING_LINE_STALE%' then raise;end if;end;
 perform public.fsux9_update_installation_line(controlled_project_id,install.id,1,1,1,'received','installed',null,null,false,'fsux9-simple-installed');
 perform public.fsux9_complete_project(controlled_project_id,2,'fsux9-simple-complete');
 if not exists(select 1 from public.furnishing_projects where id=controlled_project_id and lifecycle_status='completed')then raise exception 'SIMPLIFIED_COMPLETION_FAILED';end if;
 if before_orders<>(select count(*)from public.furnishing_procurement_orders)or before_payments<>(select count(*)from public.commerce_payments)or before_notifications<>(select count(*)from public.notification_deliveries)then raise exception 'SIMPLIFIED_EXTERNAL_EFFECT';end if;
 perform set_config('request.jwt.claim.sub','96500000-0000-4000-8000-000000000099',true);
 begin perform public.get_furnishing_simple_project(controlled_project_id);raise exception 'SIMPLIFIED_WRONG_WORKSPACE_ALLOWED';exception when insufficient_privilege then null;when others then if sqlerrm not like '%FURNISHING_ACCESS_DENIED%' then raise;end if;end;
end$$;
rollback;
select 'FS_UX_009_SIMPLIFIED_DATABASE_LIFECYCLE_PASS' result;
