-- FS-UX-009: reconcile snapshot-native installation lineage and remaining source boundaries.
begin;

alter table public.fsux7_planned_lines
  alter column source_selection_id drop not null,
  add column source_snapshot_item_id uuid references public.fs008d_snapshot_items(id);

alter table public.fsux7_planned_lines
  add constraint fsux7_planned_line_source_exactly_one check (
    (source_selection_id is not null and source_snapshot_item_id is null)
    or (source_selection_id is null and source_snapshot_item_id is not null)
  );

create or replace function public.fsux7_create_project(
  snapshot uuid,
  idempotency text,
  correlation text
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  actor uuid:=auth.uid();
  readiness public.fsux6_readiness_snapshots;
  baseline public.furnishing_procurement_baselines;
  readiness_version public.fsux6_procurement_versions;
  existing public.furnishing_installation_projects;
  installation_id uuid;
  line_count integer;
begin
  if actor is null then
    raise exception 'INSTALLATION_TRACKING_ACCESS_DENIED' using errcode='42501';
  end if;
  if length(trim(idempotency))<8 or length(trim(correlation))<3 then
    raise exception 'INSTALLATION_COMMAND_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(snapshot::text,0));
  select value.* into readiness
  from public.fsux6_readiness_snapshots value
  where value.id=fsux7_create_project.snapshot;
  if not found then raise exception 'INSTALLATION_SOURCE_NOT_APPROVED';end if;

  select value.* into baseline
  from public.furnishing_procurement_baselines value
  where value.id=readiness.baseline_id
    and value.archived_at is null
  for update;
  if not found
    or baseline.readiness_status<>'approved'
    or baseline.current_readiness_version_id is distinct from readiness.readiness_version_id
  then raise exception 'INSTALLATION_SOURCE_NOT_APPROVED';end if;

  select value.* into readiness_version
  from public.fsux6_procurement_versions value
  where value.id=readiness.readiness_version_id
    and value.baseline_id=baseline.id
    and value.state='approved'
    and value.archived_at is null
  for key share;
  if not found then raise exception 'INSTALLATION_SOURCE_NOT_APPROVED';end if;

  perform public.fsux6_assert_actor(baseline.workspace_id,false);

  select value.* into existing
  from public.furnishing_installation_projects value
  where value.source_readiness_snapshot_id=readiness.id;
  if found then
    return jsonb_build_object(
      'installation_project_id',existing.id,'idempotent',true,
      'orders_created',0,'shipments_created',0,'external_effects',false
    );
  end if;

  if exists(
    select 1
    from public.furnishing_procurement_lines line
    left join public.fs008d_snapshot_items snapshot_item
      on snapshot_item.id=line.source_snapshot_item_id
    left join public.furnishing_product_selections selection
      on selection.id=line.source_plan_line_id
    left join public.furnishing_plans selection_plan
      on selection_plan.id=selection.furnishing_plan_id
    where line.readiness_version_id=readiness.readiness_version_id
      and line.archived_at is null
      and (
        not (
          (line.source_line_kind='snapshot_item'
            and line.source_snapshot_item_id is not null
            and line.source_plan_line_id is null
            and baseline.source_kind='catalog_snapshot'
            and snapshot_item.snapshot_id=baseline.source_catalog_snapshot_id
            and snapshot_item.project_id=baseline.project_id
            and snapshot_item.room_id=line.room_id)
          or
          (line.source_line_kind='plan_selection'
            and line.source_plan_line_id is not null
            and line.source_snapshot_item_id is null
            and baseline.source_kind in('furnishing_plan','design_approval')
            and (baseline.source_plan_id is null or selection_plan.id=baseline.source_plan_id)
            and selection_plan.project_id=baseline.project_id
            and selection.room_id=line.room_id)
        )
      )
  ) then raise exception 'INSTALLATION_SOURCE_LINEAGE_INVALID';end if;

  insert into public.furnishing_installation_projects(
    workspace_id,property_id,project_id,procurement_baseline_id,status,
    tracking_status,timezone,source_snapshot,source_hash,idempotency_key,
    created_by,responsible_operator_id,source_readiness_snapshot_id
  ) values(
    baseline.workspace_id,baseline.property_id,baseline.project_id,baseline.id,
    'planning','awaiting_order_evidence','America/Chicago',readiness.snapshot,
    readiness.snapshot_digest,idempotency,actor,actor,readiness.id
  ) returning id into installation_id;
  perform public.fsux7_assert_actor(installation_id);

  insert into public.fsux7_planned_lines(
    installation_project_id,procurement_line_id,source_selection_id,
    source_snapshot_item_id,room_id,product_id,product_version_id,retailer_id,
    sku,variant,planned_quantity,priority,fulfillment_required,
    assembly_required,installation_required,baseline,baseline_digest
  )
  select installation_id,line.id,
    case when line.source_line_kind='plan_selection' then line.source_plan_line_id end,
    case when line.source_line_kind='snapshot_item' then line.source_snapshot_item_id end,
    line.room_id,line.product_id,line.product_version_id,line.retailer_id,
    line.retailer_sku,line.variant,line.procurement_quantity,line.priority,
    line.fulfillment_required,line.assembly_minor>0,line.installation_minor>0,
    to_jsonb(line),encode(digest(to_jsonb(line)::text,'sha256'),'hex')
  from public.furnishing_procurement_lines line
  where line.readiness_version_id=readiness.readiness_version_id and line.archived_at is null;
  get diagnostics line_count=row_count;
  if line_count=0 then raise exception 'INSTALLATION_SOURCE_HAS_NO_LINES';end if;

  return jsonb_build_object(
    'installation_project_id',installation_id,'planned_lines',line_count,
    'idempotent',false,'orders_created',0,'shipments_created',0,
    'external_effects',false
  );
end$$;

create or replace function public.fsux7_record_shipment(i uuid,expected bigint,input jsonb,idempotency text,correlation text)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare p public.furnishing_installation_projects;a uuid;oid uuid;olid uuid;qty numeric;ordered numeric;shipped numeric;sid uuid;begin select * into p from public.furnishing_installation_projects where id=i for update;if not found or p.current_tracking_version<>expected then raise exception 'INSTALLATION_TRACKING_STALE';end if;a:=public.fsux7_assert_action(i,'record_shipment');select id into sid from public.furnishing_shipments where installation_project_id=i and idempotency_key=idempotency;if found then return jsonb_build_object('shipment_id',sid,'idempotent',true);end if;oid:=(input->>'order_id')::uuid;olid:=(input->>'order_line_id')::uuid;qty:=(input->>'quantity')::numeric;select ol.ordered_quantity into ordered from public.furnishing_procurement_order_lines ol join public.furnishing_procurement_orders o on o.id=ol.order_id where ol.id=olid and o.id=oid and o.installation_project_id=i and o.baseline_id=p.procurement_baseline_id for update of ol;if not found then raise exception 'SHIPMENT_ORDER_LINE_INVALID';end if;select coalesce(sum(sl.quantity),0)into shipped from public.furnishing_shipment_lines sl join public.furnishing_shipments s on s.id=sl.shipment_id where sl.order_line_id=olid and s.installation_project_id=i and s.archived_at is null;if qty<=0 or shipped+qty>ordered then raise exception 'SHIPMENT_QUANTITY_EXCEEDED';end if;insert into public.furnishing_shipments(order_id,carrier,tracking_number,status,installation_project_id,evidence_class,verification_state,correlation_id,idempotency_key)values(oid,nullif(input->>'carrier',''),nullif(input->>'tracking_reference',''),'shipped',i,input->>'evidence_class',case when input->>'evidence_class' in('operator_verified','document_verified','provider_confirmed','controlled_test')then'verified'else'reported_unverified'end,correlation,idempotency)returning id into sid;insert into public.furnishing_shipment_lines(shipment_id,order_line_id,quantity)values(sid,olid,qty);update public.furnishing_installation_projects set current_tracking_version=current_tracking_version+1,updated_at=now()where id=i;return jsonb_build_object('shipment_id',sid,'idempotent',false,'external_effects',false);end$$;

create or replace function public.fsux7_record_room_allocation(i uuid,expected bigint,input jsonb,idempotency text,correlation text)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare p public.furnishing_installation_projects;a uuid;pl uuid;rl uuid;qty numeric;received numeric;allocated numeric;rid uuid;begin select * into p from public.furnishing_installation_projects where id=i for update;if not found or p.current_tracking_version<>expected then raise exception 'INSTALLATION_TRACKING_STALE';end if;a:=public.fsux7_assert_action(i,'room_allocation');select id into rid from public.fsux7_room_allocations where installation_project_id=i and idempotency_key=idempotency;if found then return jsonb_build_object('allocation_id',rid,'idempotent',true);end if;pl:=(input->>'planned_line_id')::uuid;rl:=(input->>'receipt_line_id')::uuid;qty:=(input->>'quantity')::numeric;select line.quantity into received from public.furnishing_procurement_receipt_lines line join public.furnishing_procurement_receipts receipt on receipt.id=line.receipt_id join public.fsux7_planned_lines planned on planned.procurement_line_id=line.procurement_line_id where line.id=rl and receipt.installation_project_id=i and planned.id=pl and planned.installation_project_id=i for update of line;if not found then raise exception 'ROOM_ALLOCATION_SOURCE_INVALID';end if;select coalesce(sum(value.quantity),0)into allocated from public.fsux7_room_allocations value where value.receipt_line_id=rl and value.installation_project_id=i and value.archived_at is null;if qty<=0 or allocated+qty>received then raise exception 'ROOM_ALLOCATION_QUANTITY_EXCEEDED';end if;insert into public.fsux7_room_allocations(installation_project_id,planned_line_id,receipt_line_id,source_room_id,destination_room_id,location,quantity,actor_id,correlation_id,idempotency_key)select i,value.id,rl,value.room_id,coalesce((input->>'room_id')::uuid,value.room_id),coalesce(input->>'location','room'),qty,a,correlation,idempotency from public.fsux7_planned_lines value join public.furnishing_rooms room on room.id=coalesce((input->>'room_id')::uuid,value.room_id) and room.project_id=p.project_id where value.id=pl and value.installation_project_id=i returning id into rid;if rid is null then raise exception 'ROOM_ALLOCATION_SOURCE_INVALID';end if;update public.furnishing_installation_projects set current_tracking_version=current_tracking_version+1,updated_at=now()where id=i;return jsonb_build_object('allocation_id',rid,'idempotent',false);end$$;

create or replace function public.fsux7_record_inspection(i uuid,expected bigint,input jsonb,idempotency text,correlation text)returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare p public.furnishing_installation_projects;a uuid;x uuid;pl uuid;room uuid;qty numeric;installed numeric;inspected numeric;begin select * into p from public.furnishing_installation_projects where id=i for update;if not found or p.current_tracking_version<>expected then raise exception 'INSTALLATION_TRACKING_STALE';end if;a:=public.fsux7_assert_action(i,'inspection');select id into x from public.fsux7_inspections where installation_project_id=i and idempotency_key=idempotency;if found then return jsonb_build_object('inspection_id',x,'idempotent',true);end if;pl:=nullif(input->>'planned_line_id','')::uuid;room:=nullif(input->>'room_id','')::uuid;qty:=nullif(input->>'quantity','')::numeric;if room is not null and not exists(select 1 from public.furnishing_rooms value where value.id=room and value.project_id=p.project_id)then raise exception 'INSPECTION_SOURCE_INVALID';end if;if pl is not null then if not exists(select 1 from public.fsux7_planned_lines value where value.id=pl and value.installation_project_id=i and(room is null or value.room_id=room))then raise exception 'INSPECTION_SOURCE_INVALID';end if;select coalesce(sum(value.quantity),0)into installed from public.fsux7_installation_events value where value.installation_project_id=i and value.planned_line_id=pl and value.event_type in('installed','accepted')and value.archived_at is null;select coalesce(sum(value.quantity),0)into inspected from public.fsux7_inspections value where value.installation_project_id=i and value.planned_line_id=pl and value.result in('passed','accepted_with_warnings')and value.archived_at is null;if qty is null or inspected+qty>installed then raise exception 'INSPECTION_QUANTITY_EXCEEDED';end if;end if;insert into public.fsux7_inspections(installation_project_id,room_id,inspection_type,template_version,result,checks,evidence,external_inspector,recording_actor,correlation_id,idempotency_key,planned_line_id,quantity)values(i,room,input->>'inspection_type',coalesce(input->>'template_version','fs-ux-007-v1'),input->>'result',coalesce(input->'checks','{}'),coalesce(input->'evidence','{}'),input->>'external_inspector',a,correlation,idempotency,pl,qty)returning id into x;update public.furnishing_installation_projects set tracking_status=case when input->>'inspection_type'='property'then'awaiting_inspection'else tracking_status end,current_tracking_version=current_tracking_version+1,updated_at=now()where id=i;return jsonb_build_object('inspection_id',x,'idempotent',false);end$$;

create or replace function public.fsux7_approve_completion(i uuid,expected bigint,idempotency text,correlation text)returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$declare p public.furnishing_installation_projects;a uuid;s jsonb;sid uuid;begin select * into p from public.furnishing_installation_projects where id=i for update;if not found then raise exception 'INSTALLATION_TRACKING_NOT_FOUND';end if;a:=public.fsux7_assert_action(i,'approve_completion');select id into sid from public.fsux7_completion_snapshots where installation_project_id=i and idempotency_key=idempotency;if found then return jsonb_build_object('snapshot_id',sid,'idempotent',true);end if;if p.current_tracking_version<>expected then raise exception 'INSTALLATION_TRACKING_STALE';end if;if exists(select 1 from public.fsux7_planned_lines pl where pl.installation_project_id=i and pl.fulfillment_required and((select coalesce(sum(rl.quantity),0)from public.furnishing_procurement_receipt_lines rl join public.furnishing_procurement_receipts receipt on receipt.id=rl.receipt_id where rl.procurement_line_id=pl.procurement_line_id and receipt.installation_project_id=i and receipt.archived_at is null)<pl.planned_quantity or(select coalesce(sum(e.quantity),0)from public.fsux7_installation_events e where e.installation_project_id=i and e.planned_line_id=pl.id and e.event_type in('installed','accepted')and e.archived_at is null)<pl.planned_quantity))or exists(select 1 from public.fsux7_tracking_exceptions e where e.installation_project_id=i and e.status='open' and e.severity='blocking'and e.archived_at is null)or not exists(select 1 from public.fsux7_inspections x where x.installation_project_id=i and x.inspection_type='property' and x.result in('passed','accepted_with_warnings')and x.archived_at is null)then raise exception 'INSTALLATION_COMPLETION_BLOCKED';end if;s:=jsonb_build_object('schemaVersion','fs-ux-009-installation-v2','project',to_jsonb(p),'sourceReadinessSnapshotId',p.source_readiness_snapshot_id,'plannedLines',(select jsonb_agg(to_jsonb(x)order by x.id)from public.fsux7_planned_lines x where x.installation_project_id=i),'orders',(select jsonb_agg(to_jsonb(x)order by x.created_at)from public.fsux7_order_evidence x where x.installation_project_id=i),'deliveries',(select jsonb_agg(to_jsonb(x)order by x.event_at)from public.fsux7_delivery_events x where x.installation_project_id=i),'installations',(select jsonb_agg(to_jsonb(x)order by x.created_at)from public.fsux7_installation_events x where x.installation_project_id=i),'exceptions',(select jsonb_agg(to_jsonb(x)order by x.created_at)from public.fsux7_tracking_exceptions x where x.installation_project_id=i),'inspections',(select jsonb_agg(to_jsonb(x)order by x.created_at)from public.fsux7_inspections x where x.installation_project_id=i));insert into public.fsux7_completion_snapshots(installation_project_id,tracking_version,snapshot,snapshot_digest,approved_by,correlation_id,idempotency_key)values(i,expected,s,encode(digest(s::text,'sha256'),'hex'),a,correlation,idempotency)returning id into sid;update public.furnishing_installation_projects set tracking_status='complete',status='closed',completed_by=a,completed_at=now(),current_tracking_version=current_tracking_version+1 where id=i;return jsonb_build_object('snapshot_id',sid,'idempotent',false,'external_effects',false);end$$;

revoke all on function public.fsux7_create_project(uuid,text,text),public.fsux7_record_shipment(uuid,bigint,jsonb,text,text),public.fsux7_record_room_allocation(uuid,bigint,jsonb,text,text),public.fsux7_record_inspection(uuid,bigint,jsonb,text,text),public.fsux7_approve_completion(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.fsux7_create_project(uuid,text,text),public.fsux7_record_shipment(uuid,bigint,jsonb,text,text),public.fsux7_record_room_allocation(uuid,bigint,jsonb,text,text),public.fsux7_record_inspection(uuid,bigint,jsonb,text,text),public.fsux7_approve_completion(uuid,bigint,text,text) to authenticated;

-- PostgREST must be able to traverse the canonical readiness -> installation
-- projection. RLS remains authoritative and no mutation privilege is added.
grant select(id,workspace_id,readiness_status,current_readiness_version_id,archived_at)
  on public.furnishing_procurement_baselines to authenticated;
grant select(id,workspace_id,procurement_baseline_id,tracking_status,archived_at)
  on public.furnishing_installation_projects to authenticated;
grant select on public.fsux7_planned_lines,public.fsux7_order_evidence,
  public.fsux7_delivery_events,public.fsux7_room_allocations,
  public.fsux7_installation_events,public.fsux7_tracking_exceptions,
  public.fsux7_inspections,public.fsux7_completion_snapshots to service_role;

commit;
