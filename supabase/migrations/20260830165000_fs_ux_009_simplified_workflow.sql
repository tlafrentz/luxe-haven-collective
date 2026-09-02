-- FS-UX-009 simplified customer workflow. New projects are snapshot-native;
-- legacy procurement and FS-UX-007 installation records remain read-only.
begin;

create table public.furnishing_simple_workflows(
  project_id uuid primary key references public.furnishing_projects(id) on delete cascade,
  workspace_id uuid not null references public.owners(id),
  approved_snapshot_id uuid not null unique references public.fsux5_approval_snapshots(id),
  stage text not null check(stage in('approved','procurement','installation','completed','cancelled')),
  optimistic_version bigint not null default 1 check(optimistic_version>0),
  created_by uuid not null references public.profiles(id),
  completed_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.furnishing_simple_snapshot_items(
  id uuid primary key default gen_random_uuid(),
  workflow_project_id uuid not null references public.furnishing_simple_workflows(project_id) on delete cascade,
  approved_snapshot_id uuid not null references public.fsux5_approval_snapshots(id),
  source_selection_id uuid not null,
  product_id uuid not null references public.furnishing_products(id),
  product_name text not null,
  required_quantity numeric(12,4) not null check(required_quantity>0),
  budgeted_unit_price_minor bigint not null check(budgeted_unit_price_minor>=0),
  currency text not null default 'USD' check(currency~'^[A-Z]{3}$'),
  retailer_source text,
  required boolean not null default true,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(approved_snapshot_id,source_selection_id)
);

create table public.furnishing_simple_procurement_lines(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.furnishing_simple_workflows(project_id) on delete cascade,
  snapshot_item_id uuid not null unique references public.furnishing_simple_snapshot_items(id),
  status text not null default 'not_started' check(status in('not_started','ordered','received','issue')),
  notes text,
  optimistic_version bigint not null default 1 check(optimistic_version>0),
  updated_by uuid not null references public.profiles(id),
  archived_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.furnishing_simple_installation_lines(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.furnishing_simple_workflows(project_id) on delete cascade,
  procurement_line_id uuid not null unique references public.furnishing_simple_procurement_lines(id),
  required_quantity numeric(12,4) not null check(required_quantity>0),
  received_quantity numeric(12,4) not null default 0 check(received_quantity>=0),
  installed_quantity numeric(12,4) not null default 0 check(installed_quantity>=0),
  delivery_status text not null default 'pending' check(delivery_status in('pending','received','partial','issue')),
  installation_status text not null default 'not_started' check(installation_status in('not_started','installed','issue')),
  issue_note text,
  evidence_attachment text,
  exception_accepted boolean not null default false,
  optimistic_version bigint not null default 1 check(optimistic_version>0),
  updated_by uuid not null references public.profiles(id),
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  check(received_quantity<=required_quantity),
  check(installed_quantity<=required_quantity),
  check(installed_quantity<=received_quantity)
);

create table public.furnishing_simple_activity(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.furnishing_projects(id),
  workspace_id uuid not null references public.owners(id),
  event_type text not null,
  actor_id uuid not null references public.profiles(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  evidence jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  unique(project_id,event_type,idempotency_key)
);

create function public.fsux9_simple_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$begin raise exception 'FURNISHING_APPROVED_SNAPSHOT_ITEM_IMMUTABLE';end$$;
create trigger furnishing_simple_snapshot_items_immutable before update or delete on public.furnishing_simple_snapshot_items for each row execute function public.fsux9_simple_immutable();
create trigger furnishing_simple_activity_immutable before update or delete on public.furnishing_simple_activity for each row execute function public.fsux9_simple_immutable();

create function public.fsux9_simple_actor(p_workspace uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();role_name text;
begin
  if actor is null then raise exception 'FURNISHING_ACCESS_DENIED' using errcode='42501';end if;
  role_name:=public.active_workspace_role(p_workspace);
  if role_name not in('owner','administrator','operator') then raise exception 'FURNISHING_ACCESS_DENIED' using errcode='42501';end if;
  perform public.assert_fs008g_procurement_mutation_enabled();
  return actor;
end$$;

create function public.fsux9_simple_receipt(p_project uuid,p_event text,p_key text,p_fingerprint text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior public.furnishing_simple_activity;
begin
  if length(trim(p_key))<8 then raise exception 'FURNISHING_COMMAND_INVALID';end if;
  select value.* into prior from public.furnishing_simple_activity value where value.project_id=p_project and value.event_type=p_event and value.idempotency_key=p_key;
  if found then
    if prior.request_fingerprint<>p_fingerprint then raise exception 'FURNISHING_IDEMPOTENCY_CONFLICT';end if;
    return prior.evidence||jsonb_build_object('idempotent',true);
  end if;
  return null;
end$$;

create function public.fsux9_create_procurement_checklist(p_project uuid,p_expected bigint,p_key text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare project_row public.furnishing_projects;snapshot_row public.fsux5_approval_snapshots;workflow public.furnishing_simple_workflows;actor uuid;fingerprint text;replay jsonb;line_count int;
begin
  select value.* into project_row from public.furnishing_projects value where value.id=p_project and value.archived_at is null for update;
  if not found then raise exception 'FURNISHING_PROJECT_NOT_FOUND';end if;
  actor:=public.fsux9_simple_actor(project_row.workspace_id);
  fingerprint:=encode(digest(concat_ws('|','procurement.create',p_project,p_expected)::bytea,'sha256'),'hex');
  replay:=public.fsux9_simple_receipt(p_project,'procurement_checklist_created',p_key,fingerprint);if replay is not null then return replay;end if;
  if project_row.optimistic_version<>p_expected then raise exception 'FURNISHING_PROJECT_STALE';end if;
  select value.* into snapshot_row from public.fsux5_approval_snapshots value where value.project_id=p_project order by value.created_at desc limit 1 for key share;
  if not found or project_row.lifecycle_status<>'approved' then raise exception 'FURNISHING_APPROVED_SNAPSHOT_REQUIRED';end if;
  insert into public.furnishing_simple_workflows(project_id,workspace_id,approved_snapshot_id,stage,created_by)
  values(p_project,project_row.workspace_id,snapshot_row.id,'procurement',actor) returning * into workflow;
  insert into public.furnishing_simple_snapshot_items(workflow_project_id,approved_snapshot_id,source_selection_id,product_id,product_name,required_quantity,budgeted_unit_price_minor,currency,retailer_source,required,snapshot)
  select p_project,snapshot_row.id,(item->>'id')::uuid,(item->>'product_id')::uuid,product.name,
    coalesce((item->>'resolved_quantity')::numeric,1),coalesce((item->>'estimated_unit_price_minor')::bigint,0),coalesce(item->>'currency','USD'),
    coalesce(retailer.name,offer.product_url,'Source not specified'),coalesce((item->>'required')::boolean,true),item
  from jsonb_array_elements(coalesce(snapshot_row.snapshot->'selections','[]'::jsonb)) item
  join public.furnishing_products product on product.id=(item->>'product_id')::uuid
  left join public.furnishing_product_offers offer on offer.id=nullif(item->>'selected_offer_id','')::uuid
  left join public.furnishing_retailers retailer on retailer.id=offer.retailer_id;
  get diagnostics line_count=row_count;if line_count=0 then raise exception 'FURNISHING_APPROVED_SNAPSHOT_EMPTY';end if;
  insert into public.furnishing_simple_procurement_lines(project_id,snapshot_item_id,updated_by)
  select p_project,item.id,actor from public.furnishing_simple_snapshot_items item where item.workflow_project_id=p_project;
  update public.furnishing_projects set lifecycle_status='procuring',optimistic_version=optimistic_version+1,updated_at=now() where id=p_project;
  insert into public.furnishing_simple_activity(project_id,workspace_id,event_type,actor_id,idempotency_key,request_fingerprint,evidence)
  values(p_project,project_row.workspace_id,'procurement_checklist_created',actor,p_key,fingerprint,jsonb_build_object('lineCount',line_count,'externalEffects',false));
  return jsonb_build_object('projectId',p_project,'stage','procurement','version',1,'lineCount',line_count,'idempotent',false,'externalEffects',false);
end$$;

create function public.fsux9_update_procurement_line(p_project uuid,p_line uuid,p_expected bigint,p_status text,p_notes text,p_key text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare workflow public.furnishing_simple_workflows;line public.furnishing_simple_procurement_lines;actor uuid;fingerprint text;replay jsonb;
begin
  select value.* into workflow from public.furnishing_simple_workflows value where value.project_id=p_project and value.archived_at is null for update;if not found then raise exception 'FURNISHING_WORKFLOW_NOT_FOUND';end if;
  actor:=public.fsux9_simple_actor(workflow.workspace_id);fingerprint:=encode(digest(concat_ws('|','procurement.line',p_project,p_line,p_expected,p_status,coalesce(p_notes,''))::bytea,'sha256'),'hex');
  replay:=public.fsux9_simple_receipt(p_project,'procurement_line_updated',p_key,fingerprint);if replay is not null then return replay;end if;
  if workflow.stage<>'procurement' then raise exception 'FURNISHING_STAGE_INVALID';end if;
  select value.* into line from public.furnishing_simple_procurement_lines value where value.id=p_line and value.project_id=p_project and value.archived_at is null for update;
  if not found then raise exception 'FURNISHING_LINE_NOT_FOUND';end if;if line.optimistic_version<>p_expected then raise exception 'FURNISHING_LINE_STALE';end if;
  if p_status not in('not_started','ordered','received','issue') then raise exception 'FURNISHING_STATUS_INVALID';end if;
  update public.furnishing_simple_procurement_lines set status=p_status,notes=nullif(trim(p_notes),''),optimistic_version=optimistic_version+1,updated_by=actor,updated_at=now() where id=p_line;
  insert into public.furnishing_simple_activity(project_id,workspace_id,event_type,actor_id,idempotency_key,request_fingerprint,evidence) values(p_project,workflow.workspace_id,'procurement_line_updated',actor,p_key,fingerprint,jsonb_build_object('lineId',p_line,'status',p_status,'externalEffects',false));
  return jsonb_build_object('lineId',p_line,'status',p_status,'version',p_expected+1,'idempotent',false,'externalEffects',false);
end$$;

create function public.fsux9_start_installation(p_project uuid,p_expected bigint,p_key text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare workflow public.furnishing_simple_workflows;actor uuid;fingerprint text;replay jsonb;line_count int;
begin
  select value.* into workflow from public.furnishing_simple_workflows value where value.project_id=p_project and value.archived_at is null for update;if not found then raise exception 'FURNISHING_WORKFLOW_NOT_FOUND';end if;
  actor:=public.fsux9_simple_actor(workflow.workspace_id);fingerprint:=encode(digest(concat_ws('|','installation.start',p_project,p_expected)::bytea,'sha256'),'hex');replay:=public.fsux9_simple_receipt(p_project,'installation_started',p_key,fingerprint);if replay is not null then return replay;end if;
  if workflow.optimistic_version<>p_expected then raise exception 'FURNISHING_PROJECT_STALE';end if;if workflow.stage<>'procurement' then raise exception 'FURNISHING_STAGE_INVALID';end if;
  if exists(select 1 from public.furnishing_simple_procurement_lines line where line.project_id=p_project and line.archived_at is null and line.status not in('ordered','received','issue')) then raise exception 'FURNISHING_PROCUREMENT_INCOMPLETE';end if;
  insert into public.furnishing_simple_installation_lines(project_id,procurement_line_id,required_quantity,received_quantity,delivery_status,updated_by)
  select p_project,line.id,item.required_quantity,case when line.status='received' then item.required_quantity else 0 end,case when line.status='received' then'received'else'pending'end,actor
  from public.furnishing_simple_procurement_lines line join public.furnishing_simple_snapshot_items item on item.id=line.snapshot_item_id where line.project_id=p_project and line.archived_at is null;
  get diagnostics line_count=row_count;
  update public.furnishing_simple_workflows set stage='installation',optimistic_version=optimistic_version+1,updated_at=now() where project_id=p_project;
  update public.furnishing_projects set lifecycle_status='installing',optimistic_version=optimistic_version+1,updated_at=now() where id=p_project;
  insert into public.furnishing_simple_activity(project_id,workspace_id,event_type,actor_id,idempotency_key,request_fingerprint,evidence) values(p_project,workflow.workspace_id,'installation_started',actor,p_key,fingerprint,jsonb_build_object('lineCount',line_count,'externalEffects',false));
  return jsonb_build_object('projectId',p_project,'stage','installation','version',p_expected+1,'lineCount',line_count,'idempotent',false,'externalEffects',false);
end$$;

create function public.fsux9_update_installation_line(p_project uuid,p_line uuid,p_expected bigint,p_received numeric,p_installed numeric,p_delivery text,p_installation text,p_issue text,p_attachment text,p_accept boolean,p_key text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare workflow public.furnishing_simple_workflows;line public.furnishing_simple_installation_lines;actor uuid;fingerprint text;replay jsonb;
begin
  select value.* into workflow from public.furnishing_simple_workflows value where value.project_id=p_project and value.archived_at is null for update;if not found then raise exception 'FURNISHING_WORKFLOW_NOT_FOUND';end if;
  actor:=public.fsux9_simple_actor(workflow.workspace_id);fingerprint:=encode(digest(concat_ws('|','installation.line',p_project,p_line,p_expected,p_received,p_installed,p_delivery,p_installation,coalesce(p_issue,''),coalesce(p_attachment,''),p_accept)::bytea,'sha256'),'hex');replay:=public.fsux9_simple_receipt(p_project,'installation_line_updated',p_key,fingerprint);if replay is not null then return replay;end if;
  if workflow.stage<>'installation' then raise exception 'FURNISHING_STAGE_INVALID';end if;
  select value.* into line from public.furnishing_simple_installation_lines value where value.id=p_line and value.project_id=p_project and value.archived_at is null for update;if not found then raise exception 'FURNISHING_LINE_NOT_FOUND';end if;if line.optimistic_version<>p_expected then raise exception 'FURNISHING_LINE_STALE';end if;
  if p_delivery not in('pending','received','partial','issue') or p_installation not in('not_started','installed','issue') or p_received<0 or p_installed<0 or p_received>line.required_quantity or p_installed>p_received then raise exception 'FURNISHING_STATUS_INVALID';end if;
  update public.furnishing_simple_installation_lines set received_quantity=p_received,installed_quantity=p_installed,delivery_status=p_delivery,installation_status=p_installation,issue_note=nullif(trim(p_issue),''),evidence_attachment=nullif(trim(p_attachment),''),exception_accepted=p_accept,optimistic_version=optimistic_version+1,updated_by=actor,updated_at=now() where id=p_line;
  insert into public.furnishing_simple_activity(project_id,workspace_id,event_type,actor_id,idempotency_key,request_fingerprint,evidence) values(p_project,workflow.workspace_id,'installation_line_updated',actor,p_key,fingerprint,jsonb_build_object('lineId',p_line,'received',p_received,'installed',p_installed,'deliveryStatus',p_delivery,'installationStatus',p_installation,'exceptionAccepted',p_accept,'externalEffects',false));
  return jsonb_build_object('lineId',p_line,'version',p_expected+1,'idempotent',false,'externalEffects',false);
end$$;

create function public.fsux9_complete_project(p_project uuid,p_expected bigint,p_key text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare workflow public.furnishing_simple_workflows;actor uuid;fingerprint text;replay jsonb;
begin
  select value.* into workflow from public.furnishing_simple_workflows value where value.project_id=p_project and value.archived_at is null for update;if not found then raise exception 'FURNISHING_WORKFLOW_NOT_FOUND';end if;
  actor:=public.fsux9_simple_actor(workflow.workspace_id);fingerprint:=encode(digest(concat_ws('|','project.complete',p_project,p_expected)::bytea,'sha256'),'hex');replay:=public.fsux9_simple_receipt(p_project,'project_completed',p_key,fingerprint);if replay is not null then return replay;end if;
  if workflow.optimistic_version<>p_expected then raise exception 'FURNISHING_PROJECT_STALE';end if;if workflow.stage<>'installation' then raise exception 'FURNISHING_STAGE_INVALID';end if;
  if exists(select 1 from public.furnishing_simple_installation_lines line where line.project_id=p_project and line.archived_at is null and line.installed_quantity<line.required_quantity and not line.exception_accepted) then raise exception 'FURNISHING_REQUIRED_LINES_UNRESOLVED';end if;
  update public.furnishing_simple_workflows set stage='completed',optimistic_version=optimistic_version+1,completed_at=now(),updated_at=now() where project_id=p_project;
  update public.furnishing_projects set lifecycle_status='completed',completed_at=now(),progress=100,optimistic_version=optimistic_version+1,updated_at=now() where id=p_project;
  insert into public.furnishing_simple_activity(project_id,workspace_id,event_type,actor_id,idempotency_key,request_fingerprint,evidence) values(p_project,workflow.workspace_id,'project_completed',actor,p_key,fingerprint,jsonb_build_object('externalEffects',false));
  return jsonb_build_object('projectId',p_project,'stage','completed','version',p_expected+1,'idempotent',false,'externalEffects',false);
end$$;

create function public.fsux9_cancel_project(p_project uuid,p_expected bigint,p_key text) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare workflow public.furnishing_simple_workflows;project_row public.furnishing_projects;actor uuid;fingerprint text;replay jsonb;workspace uuid;current_version bigint;
begin
  select value.* into project_row from public.furnishing_projects value where value.id=p_project and value.archived_at is null for update;if not found then raise exception 'FURNISHING_PROJECT_NOT_FOUND';end if;
  select value.* into workflow from public.furnishing_simple_workflows value where value.project_id=p_project and value.archived_at is null for update;
  workspace:=project_row.workspace_id;current_version:=coalesce(workflow.optimistic_version,project_row.optimistic_version);
  actor:=public.fsux9_simple_actor(workspace);fingerprint:=encode(digest(concat_ws('|','project.cancel',p_project,p_expected)::bytea,'sha256'),'hex');replay:=public.fsux9_simple_receipt(p_project,'project_cancelled',p_key,fingerprint);if replay is not null then return replay;end if;
  if current_version<>p_expected then raise exception 'FURNISHING_PROJECT_STALE';end if;if project_row.lifecycle_status='completed' or workflow.stage='completed' then raise exception 'FURNISHING_STAGE_INVALID';end if;
  if workflow.project_id is null then
    if not exists(select 1 from public.fsux5_approval_snapshots value where value.project_id=p_project) then raise exception 'FURNISHING_APPROVED_SNAPSHOT_REQUIRED';end if;
    insert into public.furnishing_simple_workflows(project_id,workspace_id,approved_snapshot_id,stage,created_by,cancelled_at)
    select p_project,workspace,value.id,'cancelled',actor,now() from public.fsux5_approval_snapshots value where value.project_id=p_project order by value.created_at desc limit 1;
  else
    update public.furnishing_simple_workflows set stage='cancelled',optimistic_version=optimistic_version+1,cancelled_at=now(),updated_at=now() where project_id=p_project;
  end if;
  update public.furnishing_projects set lifecycle_status='cancelled',optimistic_version=optimistic_version+1,updated_at=now() where id=p_project;
  insert into public.furnishing_simple_activity(project_id,workspace_id,event_type,actor_id,idempotency_key,request_fingerprint,evidence) values(p_project,workspace,'project_cancelled',actor,p_key,fingerprint,jsonb_build_object('externalEffects',false));
  return jsonb_build_object('projectId',p_project,'stage','cancelled','idempotent',false,'externalEffects',false);
end$$;

create function public.get_furnishing_simple_project(p_project uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare project_row public.furnishing_projects;workflow public.furnishing_simple_workflows;role_name text;
begin
  if auth.uid() is null then raise exception 'FURNISHING_ACCESS_DENIED' using errcode='42501';end if;
  select value.* into project_row from public.furnishing_projects value where value.id=p_project and value.archived_at is null;if not found then raise exception 'FURNISHING_PROJECT_NOT_FOUND';end if;
  role_name:=public.active_workspace_role(project_row.workspace_id);if role_name is null then raise exception 'FURNISHING_ACCESS_DENIED' using errcode='42501';end if;
  select value.* into workflow from public.furnishing_simple_workflows value where value.project_id=p_project and value.archived_at is null;
  return jsonb_build_object('project',to_jsonb(project_row),'stage',case when found then workflow.stage when project_row.lifecycle_status='approved'then'approved'when project_row.lifecycle_status in('awaiting_approval','designing','planning')then'ready_for_review'else'draft'end,
    'workflow',case when workflow.project_id is null then null else to_jsonb(workflow)end,
    'budget',(select to_jsonb(value) from public.furnishing_budgets value where value.project_id=p_project order by value.version_number desc limit 1),
    'snapshot',(select to_jsonb(value) from public.fsux5_approval_snapshots value where value.project_id=p_project order by value.created_at desc limit 1),
    'procurementLines',coalesce((select jsonb_agg(to_jsonb(line)||jsonb_build_object('item',to_jsonb(item)) order by item.product_name) from public.furnishing_simple_procurement_lines line join public.furnishing_simple_snapshot_items item on item.id=line.snapshot_item_id where line.project_id=p_project and line.archived_at is null),'[]'::jsonb),
    'installationLines',coalesce((select jsonb_agg(to_jsonb(line)||jsonb_build_object('procurementLine',to_jsonb(proc),'item',to_jsonb(item)) order by item.product_name) from public.furnishing_simple_installation_lines line join public.furnishing_simple_procurement_lines proc on proc.id=line.procurement_line_id join public.furnishing_simple_snapshot_items item on item.id=proc.snapshot_item_id where line.project_id=p_project and line.archived_at is null),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(value) order by value.occurred_at desc,value.id desc) from public.furnishing_simple_activity value where value.project_id=p_project),'[]'::jsonb),
    'externalEffects',false);
end$$;

alter table public.furnishing_simple_workflows enable row level security;
alter table public.furnishing_simple_snapshot_items enable row level security;
alter table public.furnishing_simple_procurement_lines enable row level security;
alter table public.furnishing_simple_installation_lines enable row level security;
alter table public.furnishing_simple_activity enable row level security;
create policy "Members read simplified workflows" on public.furnishing_simple_workflows for select to authenticated using(public.active_workspace_role(workspace_id)is not null);
create policy "Members read simplified snapshot items" on public.furnishing_simple_snapshot_items for select to authenticated using(exists(select 1 from public.furnishing_simple_workflows workflow where workflow.project_id=workflow_project_id and public.active_workspace_role(workflow.workspace_id)is not null));
create policy "Members read simplified procurement" on public.furnishing_simple_procurement_lines for select to authenticated using(exists(select 1 from public.furnishing_simple_workflows workflow where workflow.project_id=project_id and public.active_workspace_role(workflow.workspace_id)is not null));
create policy "Members read simplified installation" on public.furnishing_simple_installation_lines for select to authenticated using(exists(select 1 from public.furnishing_simple_workflows workflow where workflow.project_id=project_id and public.active_workspace_role(workflow.workspace_id)is not null));
create policy "Members read simplified activity" on public.furnishing_simple_activity for select to authenticated using(public.active_workspace_role(workspace_id)is not null);

revoke all on public.furnishing_simple_workflows,public.furnishing_simple_snapshot_items,public.furnishing_simple_procurement_lines,public.furnishing_simple_installation_lines,public.furnishing_simple_activity from public,anon,authenticated;
grant select on public.furnishing_simple_workflows,public.furnishing_simple_snapshot_items,public.furnishing_simple_procurement_lines,public.furnishing_simple_installation_lines,public.furnishing_simple_activity to authenticated;
revoke all on function public.fsux9_simple_immutable(),public.fsux9_simple_actor(uuid),public.fsux9_simple_receipt(uuid,text,text,text),public.fsux9_create_procurement_checklist(uuid,bigint,text),public.fsux9_update_procurement_line(uuid,uuid,bigint,text,text,text),public.fsux9_start_installation(uuid,bigint,text),public.fsux9_update_installation_line(uuid,uuid,bigint,numeric,numeric,text,text,text,text,boolean,text),public.fsux9_complete_project(uuid,bigint,text),public.fsux9_cancel_project(uuid,bigint,text),public.get_furnishing_simple_project(uuid) from public,anon,authenticated;
grant execute on function public.fsux9_create_procurement_checklist(uuid,bigint,text),public.fsux9_update_procurement_line(uuid,uuid,bigint,text,text,text),public.fsux9_start_installation(uuid,bigint,text),public.fsux9_update_installation_line(uuid,uuid,bigint,numeric,numeric,text,text,text,text,boolean,text),public.fsux9_complete_project(uuid,bigint,text),public.fsux9_cancel_project(uuid,bigint,text),public.get_furnishing_simple_project(uuid) to authenticated;

commit;
