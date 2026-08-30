-- FS-UX-003: governed inventory import workflow. Platform drafts only; no external effects.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('furnishing-import-sources','furnishing-import-sources',false,26214400,array['text/csv','application/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.furnishing_catalog_imports drop constraint if exists furnishing_catalog_imports_source_type_check;
alter table public.furnishing_catalog_imports drop constraint if exists furnishing_catalog_imports_status_check;
alter table public.furnishing_catalog_imports
  add constraint furnishing_catalog_imports_source_type_check check(source_type in('csv','xlsx')) not valid,
  add constraint furnishing_catalog_imports_status_check check(status in(
    'uploading','created','uploaded','parsing','parsed','mapping','mapping_required','validating','validation_blocked',
    'ready_to_reconcile','reconciling','ready_to_commit','importing','committing','partial_success','complete_with_skips',
    'complete_with_warnings','failed','cancelled','superseded','complete','review_required'
  )) not valid;
alter table public.furnishing_catalog_imports
  add column if not exists organization_id uuid references public.owners(id),
  add column if not exists sanitized_filename text,
  add column if not exists source_size_bytes bigint check(source_size_bytes is null or source_size_bytes between 1 and 26214400),
  add column if not exists storage_path text,
  add column if not exists duplicate_source_import_id uuid references public.furnishing_catalog_imports(id),
  add column if not exists candidate_version text,
  add column if not exists selected_sheet text,
  add column if not exists workbook_metadata jsonb not null default '{}',
  add column if not exists parsing_configuration jsonb not null default '{}',
  add column if not exists mapping_version bigint not null default 0,
  add column if not exists validation_version bigint not null default 0,
  add column if not exists reconciliation_version bigint not null default 0,
  add column if not exists warning_count integer not null default 0,
  add column if not exists blocking_count integer not null default 0,
  add column if not exists unresolved_count integer not null default 0,
  add column if not exists updated_draft_count integer not null default 0,
  add column if not exists proposed_revision_count integer not null default 0,
  add column if not exists commit_started_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
update public.furnishing_catalog_imports set organization_id=workspace_id,sanitized_filename=source_filename where organization_id is null;
create index if not exists furnishing_import_history_idx on public.furnishing_catalog_imports(organization_id,created_at desc);
create index if not exists furnishing_import_digest_idx on public.furnishing_catalog_imports(organization_id,source_sha256);

alter table public.furnishing_catalog_import_items drop constraint if exists furnishing_catalog_import_items_review_action_check;
alter table public.furnishing_catalog_import_items
  add constraint furnishing_catalog_import_items_review_action_check check(review_action in(
    'review','create','match','skip','update_draft','propose_revision','unresolved'
  )) not valid;
alter table public.furnishing_catalog_import_items
  add column if not exists source_values jsonb not null default '{}',
  add column if not exists canonical_values jsonb not null default '{}',
  add column if not exists corrections jsonb not null default '{}',
  add column if not exists validation_classification text not null default 'blocking_error'
    check(validation_classification in('valid','valid_with_warnings','blocking_error','intentionally_skipped','duplicate_candidate','existing_product_match','ambiguous_match')),
  add column if not exists validation_evidence jsonb not null default '[]',
  add column if not exists reconciliation_decision text
    check(reconciliation_decision is null or reconciliation_decision in('create','update_draft','propose_revision','link_unchanged','skip','unresolved')),
  add column if not exists reconciliation_evidence jsonb not null default '{}',
  add column if not exists expected_product_revision bigint,
  add column if not exists source_row_digest text,
  add column if not exists outcome text,
  add column if not exists outcome_reason text,
  add column if not exists corrected_by uuid references public.profiles(id),
  add column if not exists corrected_at timestamptz,
  add column if not exists committed_at timestamptz;
create index if not exists furnishing_import_item_validation_idx on public.furnishing_catalog_import_items(import_id,validation_classification);
create index if not exists furnishing_import_item_reconciliation_idx on public.furnishing_catalog_import_items(import_id,reconciliation_decision);

create table public.furnishing_import_stage_evidence(
  id uuid primary key default gen_random_uuid(),import_id uuid not null references public.furnishing_catalog_imports(id),
  stage text not null check(stage in('upload','parse','mapping','validation','reconciliation','commit','cancel')),
  version bigint not null,result text not null,actor_id uuid not null references public.profiles(id),correlation_id text not null,
  idempotency_key text not null unique,evidence jsonb not null default '{}',created_at timestamptz not null default now(),
  unique(import_id,stage,version)
);
alter table public.furnishing_import_stage_evidence enable row level security;
create policy "Authorized members read import stage evidence" on public.furnishing_import_stage_evidence for select to authenticated
using(exists(select 1 from public.furnishing_catalog_imports i where i.id=import_id and (public.active_workspace_role(i.workspace_id) is not null or public.is_admin())));
revoke all on public.furnishing_import_stage_evidence from public,anon,authenticated;
grant select on public.furnishing_import_stage_evidence to authenticated;

create or replace function public.commit_furnishing_inventory_import(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare actor uuid;target uuid;expected bigint;command_key text;correlation text;run public.furnishing_catalog_imports%rowtype;item public.furnishing_catalog_import_items%rowtype;existing public.furnishing_import_stage_evidence%rowtype;product_id uuid;version_id uuid;created_n int:=0;updated_n int:=0;revision_n int:=0;matched_n int:=0;skipped_n int:=0;fingerprint text;
begin
 if auth.role()<>'service_role' then raise exception 'FURNISHING_IMPORT_SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 begin actor:=(p_input->>'actor_id')::uuid;target:=(p_input->>'import_id')::uuid;expected:=(p_input->>'expected_version')::bigint;exception when others then raise exception 'FURNISHING_IMPORT_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);
 if length(command_key)<8 or length(correlation)<8 or not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'FURNISHING_IMPORT_COMMIT_FORBIDDEN' using errcode='42501';end if;
 select * into existing from public.furnishing_import_stage_evidence where idempotency_key=command_key;
 if found then if existing.import_id<>target or existing.stage<>'commit' then raise exception 'FURNISHING_IMPORT_REPLAY_CONFLICT';end if;return existing.evidence||jsonb_build_object('status','replayed','evidenceId',existing.id);end if;
 select * into run from public.furnishing_catalog_imports where id=target for update;
 if not found then raise exception 'FURNISHING_IMPORT_NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('furnishing-import:'||target::text,0));
 if run.status in('complete','complete_with_skips','complete_with_warnings') then
  select * into existing from public.furnishing_import_stage_evidence where import_id=target and stage='commit' and idempotency_key=command_key;
  if found then return existing.evidence||jsonb_build_object('status','replayed','evidenceId',existing.id);end if;
  raise exception 'FURNISHING_IMPORT_ALREADY_COMMITTED';
 end if;
 if run.status<>'ready_to_commit' or run.optimistic_version<>expected or run.source_sha256 is null or run.mapping_version<1 or run.validation_version<1 or run.reconciliation_version<1 then raise exception 'FURNISHING_IMPORT_NOT_READY_OR_STALE';end if;
 if exists(select 1 from public.furnishing_catalog_import_items where import_id=target and (validation_classification='blocking_error' or reconciliation_decision is null or reconciliation_decision='unresolved')) then raise exception 'FURNISHING_IMPORT_UNRESOLVED_ROWS';end if;
 fingerprint:=encode(digest(concat_ws('|',run.source_sha256,run.mapping_version,run.validation_version,run.reconciliation_version)::bytea,'sha256'),'hex');
 update public.furnishing_catalog_imports set status='committing',commit_started_at=now(),updated_at=now() where id=target;
 for item in select * from public.furnishing_catalog_import_items where import_id=target order by source_sheet,source_row for update loop
  if item.reconciliation_decision='skip' then skipped_n:=skipped_n+1;update public.furnishing_catalog_import_items set outcome='skipped',outcome_reason=coalesce(outcome_reason,'Authorized skip'),committed_at=now() where id=item.id;continue;end if;
  if item.reconciliation_decision='link_unchanged' then
   if item.matched_product_id is null then raise exception 'FURNISHING_IMPORT_MATCH_REQUIRED';end if;matched_n:=matched_n+1;product_id:=item.matched_product_id;
  elsif item.reconciliation_decision='create' then
   insert into public.furnishing_products(scope,workspace_id,name,product_type,category,status,created_by,source_type,source_import_id,source_sheet,source_row,imported_at,brand,manufacturer_part_number)
   values('platform',null,item.proposed_name,'catalog_item',coalesce(item.canonical_values->>'category','Imported'),'draft',actor,run.source_type,target,item.source_sheet,item.source_row,now(),nullif(item.canonical_values->>'brand',''),nullif(item.canonical_values->>'sku','')) returning id into product_id;
   created_n:=created_n+1;
  elsif item.reconciliation_decision='update_draft' then
   select id into product_id from public.furnishing_products where id=item.matched_product_id and scope='platform' and workspace_id is null and status in('draft','changes_requested') and revision=item.expected_product_revision for update;
   if not found then raise exception 'FURNISHING_IMPORT_PRODUCT_STALE';end if;
   update public.furnishing_products set name=item.proposed_name,brand=nullif(item.canonical_values->>'brand',''),manufacturer_part_number=nullif(item.canonical_values->>'sku',''),revision=revision+1,updated_at=now() where id=product_id;updated_n:=updated_n+1;
  elsif item.reconciliation_decision='propose_revision' then
   select id into product_id from public.furnishing_products where id=item.matched_product_id and scope='platform' and workspace_id is null and status='approved' and revision=item.expected_product_revision for update;
   if not found then raise exception 'FURNISHING_IMPORT_PRODUCT_STALE';end if;
   insert into public.furnishing_product_versions(product_id,version,lifecycle_status,base_version,change_reason,product_snapshot,created_by,idempotency_key,correlation_id)
   values(product_id,item.expected_product_revision+1,'proposed',item.expected_product_revision,'Inventory import proposal',item.canonical_values,actor,command_key||':'||item.id,correlation::uuid) returning id into version_id;revision_n:=revision_n+1;
  else raise exception 'FURNISHING_IMPORT_RECONCILIATION_INVALID';end if;
  update public.furnishing_catalog_import_items set imported_product_id=product_id,outcome=case when reconciliation_decision='propose_revision' then 'revision_proposed' when reconciliation_decision='update_draft' then 'draft_updated' when reconciliation_decision='link_unchanged' then 'existing_match' else 'platform_draft_created' end,committed_at=now() where id=item.id;
  insert into public.furnishing_catalog_activity(workspace_id,product_id,import_id,event_type,actor_id,metadata) values(run.workspace_id,product_id,target,'inventory_import_row_committed',actor,jsonb_build_object('sourceRow',item.source_row,'decision',item.reconciliation_decision,'externalEffects',false));
 end loop;
 update public.furnishing_catalog_imports set status=case when skipped_n>0 then 'complete_with_skips' when warning_count>0 then 'complete_with_warnings' else 'complete' end,created_count=created_n,updated_draft_count=updated_n,proposed_revision_count=revision_n,matched_count=matched_n,skipped_count=skipped_n,failed_count=0,completed_at=now(),apply_idempotency_key=command_key,apply_fingerprint=fingerprint,optimistic_version=optimistic_version+1,updated_at=now() where id=target returning * into run;
 insert into public.furnishing_import_stage_evidence(import_id,stage,version,result,actor_id,correlation_id,idempotency_key,evidence) values(target,'commit',run.optimistic_version,'complete',actor,correlation,command_key,jsonb_build_object('status','complete','importId',target,'created',created_n,'updatedDrafts',updated_n,'proposedRevisions',revision_n,'existingMatches',matched_n,'skipped',skipped_n,'fingerprint',fingerprint,'externalEffects',false)) returning * into existing;
 return existing.evidence||jsonb_build_object('evidenceId',existing.id);
end$$;
revoke all on function public.commit_furnishing_inventory_import(jsonb) from public,anon,authenticated;
grant execute on function public.commit_furnishing_inventory_import(jsonb) to service_role;

commit;
