\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',:'actor_id',true);
select set_config('fsux9.workspace_id',:'workspace_id',true);
select set_config('fsux9.property_id',:'property_id',true);
select set_config('fsux9.actor_id',:'actor_id',true);

insert into public.furnishing_retailers(id,name,website_url,status)
values('96600000-0000-4000-8000-000000000002','FSUX9 Manual Source','https://example.invalid','active');
insert into public.furnishing_products(id,workspace_id,name,product_type,category,status,scope,created_by,revision)
values('96600000-0000-4000-8000-000000000003',:'workspace_id','FSUX9 Browser Required Chair','catalog_item','Furniture','approved','workspace',:'actor_id',1);
insert into public.furnishing_product_versions(id,product_id,workspace_id,version,lifecycle_status,product_snapshot,correlation_id,idempotency_key,created_by,approved_by,approved_at)
values('96600000-0000-4000-8000-000000000004','96600000-0000-4000-8000-000000000003',:'workspace_id',1,'approved','{}','96600000-0000-4000-8000-000000000014','fsux9-simple-browser-product',:'actor_id',:'actor_id',now());
insert into public.furnishing_product_offers(id,product_id,retailer_id,product_url,listed_price_minor,shipping_price_minor,currency,availability,last_verified_at,status)
values('96600000-0000-4000-8000-000000000005','96600000-0000-4000-8000-000000000003','96600000-0000-4000-8000-000000000002','https://example.invalid/chair',25000,0,'USD','in_stock',now(),'active');

do $$
declare created jsonb;controlled_project uuid;design_version uuid;budget_id uuid;room_id uuid;customer_event uuid;
begin
 created:=public.fsux5_create_design_workspace(current_setting('fsux9.workspace_id')::uuid,current_setting('fsux9.property_id')::uuid,'FSUX9 Simplified Browser Project',null,'{}',jsonb_build_object('currency','USD','target_minimum_minor',20000,'target_maximum_minor',30000,'inclusion_basis','products_delivery'),'fsux9-simple-browser-design','96600000-0000-4000-8000-000000000015');
 controlled_project:=(created->>'project_id')::uuid;design_version:=(created->>'design_version_id')::uuid;budget_id:=(created->>'budget_id')::uuid;
 insert into public.furnishing_rooms(project_id,design_version_id,room_type,name,sort_order,status)values(controlled_project,design_version,'living_room','Living room',0,'planning')returning id into room_id;
 insert into public.furnishing_product_selections(room_id,design_version_id,product_id,product_version_id,selected_offer_id,resolved_quantity,estimated_unit_price_minor,estimated_total_minor,currency,price_observed_at,selection_source,selection_status,required,priority,correlation_id)values(room_id,design_version,'96600000-0000-4000-8000-000000000003','96600000-0000-4000-8000-000000000004','96600000-0000-4000-8000-000000000005',1,25000,25000,'USD',now(),'manual','approved',true,'essential','96600000-0000-4000-8000-000000000016');
 update public.fsux5_design_versions set state='customer_review' where id=design_version;
 update public.furnishing_budgets set lifecycle_status='customer_review',product_subtotal_minor=25000,estimated_total_minor=25000 where id=budget_id;
 insert into public.fsux5_review_events(project_id,design_version_id,budget_id,stage,decision,customer_identity,recording_actor,correlation_id,idempotency_key)values(controlled_project,design_version,budget_id,'customer','approved',current_setting('fsux9.actor_id')::uuid,current_setting('fsux9.actor_id')::uuid,'fsux9-simple-browser-review','fsux9-simple-browser-review')returning id into customer_event;
 perform public.fsux5_approve_design(controlled_project,1,customer_event,'fsux9-simple-browser-approval','fsux9-simple-browser-approval');
 raise notice 'FSUX9_SIMPLIFIED_PROJECT_ID=%',controlled_project;
end$$;
commit;
