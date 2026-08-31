\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.properties(id,owner_id,name,slug,description,city,state,bedrooms,bathrooms,max_guests,property_type,timezone,source,product_participation) values('93000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','FSUX5 furnishing-only property','fsux5-furnishing-only-property','Controlled local fixture','Austin','TX',2,2,6,'home','America/Chicago','manual',array['furnishing_project']);
do $$declare result jsonb;project_id uuid;version_id uuid;budget_id uuid;customer_event uuid;approved jsonb;handoff jsonb;before_orders bigint;before_payments bigint;before_notifications bigint;
begin
 select count(*) into before_orders from public.furnishing_procurement_orders;select count(*) into before_payments from public.commerce_payments;select count(*) into before_notifications from public.notifications;
 result:=public.fsux5_create_design_workspace('20000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','FSUX5 controlled furnishing-only design',null,jsonb_build_object('design_direction','warm modern','maximum_guests',6),jsonb_build_object('currency','USD','target_minimum_minor',1100000,'target_maximum_minor',1400000,'inclusion_basis','products_delivery'),'fsux5-create-command','fsux5-create-correlation');
 project_id:=(result->>'project_id')::uuid;version_id:=(result->>'design_version_id')::uuid;budget_id:=(result->>'budget_id')::uuid;
 if public.fsux5_create_design_workspace('20000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','FSUX5 controlled furnishing-only design',null,'{}','{}','fsux5-create-command','fsux5-create-correlation')->>'idempotent'<>'true' then raise exception 'FSUX5_CREATE_REPLAY_FAILED';end if;
 if exists(select 1 from public.property_capability_enrollments where property_id='93000000-0000-4000-8000-000000000001' and capability='hpm')then raise exception 'FSUX5_HPM_ENABLED';end if;
 update public.fsux5_design_versions set state='customer_review' where id=version_id;update public.furnishing_budgets set lifecycle_status='customer_review' where id=budget_id;
 insert into public.fsux5_review_events(project_id,design_version_id,budget_id,stage,decision,customer_identity,recording_actor,correlation_id,idempotency_key)values(project_id,version_id,budget_id,'customer','approved','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','fsux5-customer-correlation','fsux5-customer-command')returning id into customer_event;
 approved:=public.fsux5_approve_design(project_id,1,customer_event,'fsux5-approval-command','fsux5-approval-correlation');
 if public.fsux5_approve_design(project_id,1,customer_event,'fsux5-approval-command','fsux5-approval-correlation')->>'idempotent'<>'true' then raise exception 'FSUX5_APPROVAL_REPLAY_FAILED';end if;
 begin update public.fsux5_approval_snapshots set snapshot='{}' where id=(approved->>'snapshot_id')::uuid;raise exception 'FSUX5_SNAPSHOT_MUTABLE';exception when others then if sqlerrm not like '%DESIGN_APPROVAL_EVIDENCE_IMMUTABLE%' then raise;end if;end;
 handoff:=public.fsux5_prepare_procurement_handoff(project_id,'fsux5-handoff-command','fsux5-handoff-correlation');
 if handoff->>'external_effects'<>'false' or public.fsux5_prepare_procurement_handoff(project_id,'fsux5-handoff-command','fsux5-handoff-correlation')->>'idempotent'<>'true' then raise exception 'FSUX5_HANDOFF_REPLAY_FAILED';end if;
 if before_orders<>(select count(*)from public.furnishing_procurement_orders)or before_payments<>(select count(*)from public.commerce_payments)or before_notifications<>(select count(*)from public.notifications)then raise exception 'FSUX5_EXTERNAL_EFFECT';end if;
 begin perform public.fsux5_approve_design(project_id,999,customer_event,'stale','stale');raise exception 'FSUX5_STALE_APPROVAL_ALLOWED';exception when others then if sqlerrm not like '%DESIGN_WORKSPACE_STALE%' then raise;end if;end;
end$$;
do $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','anon',true);begin perform public.fsux5_create_design_workspace('20000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','denied',null,'{}','{}','anon','anon');raise exception 'FSUX5_ANON_ALLOWED';exception when insufficient_privilege then null;when others then if sqlerrm not like '%DESIGN_WORKSPACE_ACCESS_DENIED%' then raise;end if;end;end$$;
rollback;
select 'FS_UX_005_DATABASE_MATRIX_PASS' as result;
