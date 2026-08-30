\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

insert into public.furnishing_products(id,workspace_id,name,product_type,category,status,scope,created_by,revision)
values
('91000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FSUX4 controlled furnishing','catalog_item','Furniture','approved','workspace','10000000-0000-4000-8000-000000000001',1),
('91000000-0000-4000-8000-000000000002',null,'FSUX4 platform recommendation','catalog_item','Furniture','approved','platform','10000000-0000-4000-8000-000000000001',1);

do $$declare created jsonb;pid uuid;vid uuid;mut jsonb;validated jsonb;submitted jsonb;reviewed jsonb;revision jsonb;approved_room uuid;approved_hash text;
begin
 created:=public.fsux4_create_package(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','scope','workspace','name','FSUX4 controlled 2BR package','property_type','house','design_direction','warm modern','quality_tier','essential','bedrooms','2','bathrooms','2','maximum_guests','6','currency','USD','target_min_minor','1100000','target_max_minor','1400000','budget_basis','products_delivery','profile',jsonb_build_object('includedSpaces',jsonb_build_array('living_room','dining_area','primary_bedroom','guest_bedroom','workspace')),'correlation_id','fsux4-create-correlation','idempotency_key','fsux4-create-command'));
 pid:=(created->>'packageId')::uuid;vid:=(created->>'versionId')::uuid;
 if (public.fsux4_create_package(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','scope','workspace','name','FSUX4 controlled 2BR package','property_type','house','correlation_id','fsux4-create-correlation','idempotency_key','fsux4-create-command'))->>'status')<>'replayed' then raise exception 'FSUX4_CREATE_REPLAY_FAILED';end if;

 mut:=public.fsux4_mutate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',1,'operation','add_room','canonical_room_type','living_room','display_name','Living room','sleeping_capacity',6,'correlation_id','fsux4-room-correlation','idempotency_key','fsux4-room-command'));
 approved_room:=(mut->>'roomId')::uuid;
 perform public.fsux4_mutate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',2,'operation','add_item','room_id',approved_room,'product_id','91000000-0000-4000-8000-000000000001','quantity',6,'priority','essential','item_kind','dining_seating','unit_price_minor',10000,'currency','USD','correlation_id','fsux4-dining-correlation','idempotency_key','fsux4-dining-command'));
 perform public.fsux4_mutate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',3,'operation','add_item','room_id',approved_room,'product_id','91000000-0000-4000-8000-000000000001','quantity',6,'priority','essential','item_kind','seating','unit_price_minor',10000,'currency','USD','correlation_id','fsux4-seating-correlation','idempotency_key','fsux4-seating-command'));

 begin perform public.fsux4_mutate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',4,'operation','add_item','room_id',approved_room,'product_id','91000000-0000-4000-8000-000000000002','quantity',1,'priority','essential','correlation_id','fsux4-platform-correlation','idempotency_key','fsux4-platform-command'));raise exception 'FSUX4_PLATFORM_PRODUCT_ALLOWED';exception when others then if sqlerrm not like '%ROOM_PACKAGE_PRODUCT_INELIGIBLE_OR_ADOPTION_REQUIRED%' then raise;end if;end;
 begin perform public.fsux4_mutate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',4,'operation','add_item','room_id',approved_room,'product_id','91000000-0000-4000-8000-000000000001','quantity',1,'priority','required','correlation_id','fsux4-priority-correlation','idempotency_key','fsux4-priority-command'));raise exception 'FSUX4_REQUIRED_PRIORITY_ALLOWED';exception when others then if sqlerrm not like '%ROOM_PACKAGE_PRIORITY_INVALID%' then raise;end if;end;

 validated:=public.fsux4_validate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',4,'correlation_id','fsux4-validation-correlation'));
 if validated->>'status'<>'ready' or (validated->>'blocking')::int<>0 then raise exception 'FSUX4_VALIDATION_FAILED %',validated;end if;
 submitted:=public.fsux4_submit_package_review(jsonb_build_object('package_id',pid,'package_version_id',vid,'validation_run_id',validated->>'validationRunId','expected_version',4,'correlation_id','fsux4-submit-correlation','idempotency_key','fsux4-submit-command'));
 if submitted->>'status'<>'in_review' or not exists(select 1 from public.fsux4_package_review_events where package_version_id=vid and event_type='submitted' and evidence ? 'snapshot') then raise exception 'FSUX4_ATOMIC_SUBMISSION_FAILED';end if;
 reviewed:=public.fsux4_review_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',5,'decision','approve','reason','Controlled package approval','correlation_id','fsux4-approval-correlation','idempotency_key','fsux4-approval-command'));
 if reviewed->>'status'<>'approved' then raise exception 'FSUX4_APPROVAL_FAILED %',reviewed;end if;
 select snapshot_hash into approved_hash from public.fsux4_package_approval_snapshots where package_version_id=vid;
 begin update public.fsux4_package_rooms set display_name='mutated' where id=approved_room;raise exception 'FSUX4_APPROVED_ROOM_MUTABLE';exception when others then if sqlerrm not like '%ROOM_PACKAGE_APPROVED_SNAPSHOT_IMMUTABLE%' then raise;end if;end;
 revision:=public.fsux4_create_package_revision(jsonb_build_object('package_id',pid,'source_version_id',vid,'expected_version',6,'reason','Controlled revision','correlation_id','fsux4-revision-correlation','idempotency_key','fsux4-revision-command'));
 if revision->>'status'<>'draft' or not exists(select 1 from public.furnishing_package_versions where id=(revision->>'revisionVersionId')::uuid and based_on_version_id=vid) then raise exception 'FSUX4_REVISION_FAILED';end if;
 if approved_hash is distinct from (select snapshot_hash from public.fsux4_package_approval_snapshots where package_version_id=vid) then raise exception 'FSUX4_APPROVED_SNAPSHOT_CHANGED';end if;
 if exists(select 1 from public.furnishing_product_adoptions where workspace_product_id in(select product_id from public.fsux4_package_items where package_version_id=vid)) then raise exception 'FSUX4_SILENT_PRODUCT_ADOPTION';end if;
end$$;

do $$declare created jsonb;pid uuid;vid uuid;room_result jsonb;room_id uuid;validated jsonb;adopted jsonb;replayed jsonb;workspace_package uuid;
begin
 created:=public.fsux4_create_package(jsonb_build_object('scope','platform','name','FSUX4 controlled platform template','property_type','house','design_direction','warm modern','quality_tier','essential','bedrooms','0','bathrooms','0','maximum_guests','0','currency','USD','target_min_minor','0','target_max_minor','0','budget_basis','products_only','profile','{}','correlation_id','fsux4-template-create-correlation','idempotency_key','fsux4-template-create-command'));
 pid:=(created->>'packageId')::uuid;vid:=(created->>'versionId')::uuid;
 room_result:=public.fsux4_mutate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',1,'operation','add_room','canonical_room_type','living_room','display_name','Living room','sleeping_capacity',0,'correlation_id','fsux4-template-room-correlation','idempotency_key','fsux4-template-room-command'));room_id:=(room_result->>'roomId')::uuid;
 perform public.fsux4_mutate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',2,'operation','add_item','room_id',room_id,'product_id','91000000-0000-4000-8000-000000000002','quantity',1,'priority','essential','item_kind','other','unit_price_minor',10000,'currency','USD','correlation_id','fsux4-template-item-correlation','idempotency_key','fsux4-template-item-command'));
 validated:=public.fsux4_validate_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',3,'correlation_id','fsux4-template-validation-correlation'));
 perform public.fsux4_submit_package_review(jsonb_build_object('package_id',pid,'package_version_id',vid,'validation_run_id',validated->>'validationRunId','expected_version',3,'correlation_id','fsux4-template-submit-correlation','idempotency_key','fsux4-template-submit-command'));
 perform public.fsux4_review_package(jsonb_build_object('package_id',pid,'package_version_id',vid,'expected_version',4,'decision','approve','reason','Controlled template approval','correlation_id','fsux4-template-approve-correlation','idempotency_key','fsux4-template-approve-command'));
 adopted:=public.fsux4_adopt_template(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','source_template_id',pid,'source_version_id',vid,'product_mapping','{}','workspace_overrides','{}','correlation_id','fsux4-template-adopt-correlation','idempotency_key','fsux4-template-adopt-command'));
 replayed:=public.fsux4_adopt_template(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','source_template_id',pid,'source_version_id',vid,'product_mapping','{}','workspace_overrides','{}','correlation_id','fsux4-template-adopt-correlation','idempotency_key','fsux4-template-adopt-command'));
 workspace_package:=(adopted->>'packageId')::uuid;
 if adopted->>'status'<>'draft' or replayed->>'status'<>'replayed' then raise exception 'FSUX4_TEMPLATE_ADOPTION_REPLAY_FAILED % %',adopted,replayed;end if;
 if not exists(select 1 from public.furnishing_packages where id=workspace_package and governance_scope='workspace' and workspace_id='20000000-0000-4000-8000-000000000001' and source_template_id=pid and source_template_version_id=vid) then raise exception 'FSUX4_TEMPLATE_LINEAGE_FAILED';end if;
 if not exists(select 1 from public.fsux4_package_items i join public.furnishing_package_versions v on v.id=i.package_version_id where v.furnishing_package_id=workspace_package and i.product_id is null and i.unresolved_reason is not null) then raise exception 'FSUX4_TEMPLATE_UNRESOLVED_ADOPTION_REQUIREMENT_MISSING';end if;
 if exists(select 1 from public.furnishing_product_adoptions a where a.source_product_id='91000000-0000-4000-8000-000000000002') then raise exception 'FSUX4_TEMPLATE_SILENTLY_ADOPTED_PRODUCT';end if;
end$$;

do $$begin
 if (select count(*) from public.furnishing_packages where governance_scope='legacy_ambiguous' and workspace_id is null and current_version_id is null)<>3 then raise exception 'FSUX4_LEGACY_DISPOSITION_CHANGED';end if;
 begin update public.furnishing_packages set lifecycle_status='in_review' where id='4d162594-f9a7-45e9-881e-adba36cd7406';raise exception 'FSUX4_LEGACY_MUTABLE';exception when others then if sqlerrm not like '%FURNISHING_PACKAGE_LEGACY_REVIEW_REQUIRED%' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','anon',true);
 begin perform public.fsux4_create_package('{}');raise exception 'FSUX4_ANON_ALLOWED';exception when insufficient_privilege then null;when others then if sqlerrm not like '%ROOM_PACKAGE_ADMIN_REQUIRED%' then raise;end if;end;
end$$;
rollback;
select 'FS_UX_004_DATABASE_MATRIX_PASS' as result;
