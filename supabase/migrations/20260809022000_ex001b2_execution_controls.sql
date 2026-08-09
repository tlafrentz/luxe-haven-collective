-- EX-001B2: atomic evidence, blocker, dependency, review, and completion controls.
begin;

alter table public.platform_action_evidence drop constraint if exists platform_action_evidence_review_status_check;
alter table public.platform_action_evidence add constraint platform_action_evidence_review_status_check check(review_status in ('pending','submitted','accepted','rejected','superseded','not-required'));
alter table public.platform_action_evidence add column if not exists submitted_at timestamptz,add column if not exists superseded_by_id text,add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.platform_action_evidence add constraint platform_action_evidence_superseded_fk foreign key(workspace_id,superseded_by_id) references public.platform_action_evidence(workspace_id,id) on delete restrict;

alter table public.platform_action_activity drop constraint if exists platform_action_activity_entity_type_check;
alter table public.platform_action_activity add constraint platform_action_activity_entity_type_check check(entity_type in ('plan','action','evidence','blocker','dependency','recurrence','escalation'));
alter table public.execute_notification_outbox drop constraint if exists execute_notification_outbox_entity_type_check;
alter table public.execute_notification_outbox add constraint execute_notification_outbox_entity_type_check check(entity_type in ('plan','action','evidence','blocker','dependency','recurrence','escalation'));

drop policy if exists "Members manage Execute blockers" on public.platform_action_blockers;
create policy "Members manage authorized Execute blockers" on public.platform_action_blockers for all to authenticated
using(exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_blockers.workspace_id and action.id=platform_action_blockers.action_id and (action.property_id is null or public.can_access_workspace_property(action.property_id))))
with check(exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_blockers.workspace_id and action.id=platform_action_blockers.action_id and (action.property_id is null or public.can_access_workspace_property(action.property_id))));
drop policy if exists "Members manage Execute evidence" on public.platform_action_evidence;
create policy "Members manage authorized Execute evidence" on public.platform_action_evidence for all to authenticated
using(exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_evidence.workspace_id and action.id=platform_action_evidence.action_id and (action.property_id is null or public.can_access_workspace_property(action.property_id))))
with check(exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_evidence.workspace_id and action.id=platform_action_evidence.action_id and (action.property_id is null or public.can_access_workspace_property(action.property_id))));
drop policy if exists "Members manage Execute dependencies" on public.platform_action_dependencies;
create policy "Members manage authorized Execute dependencies" on public.platform_action_dependencies for all to authenticated
using(exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_dependencies.workspace_id and action.id=platform_action_dependencies.action_id and (action.property_id is null or public.can_access_workspace_property(action.property_id))) and exists(select 1 from public.platform_actions dependency where dependency.workspace_id=platform_action_dependencies.workspace_id and dependency.id=platform_action_dependencies.depends_on_action_id and (dependency.property_id is null or public.can_access_workspace_property(dependency.property_id))))
with check(exists(select 1 from public.platform_actions action where action.workspace_id=platform_action_dependencies.workspace_id and action.id=platform_action_dependencies.action_id and (action.property_id is null or public.can_access_workspace_property(action.property_id))) and exists(select 1 from public.platform_actions dependency where dependency.workspace_id=platform_action_dependencies.workspace_id and dependency.id=platform_action_dependencies.depends_on_action_id and (dependency.property_id is null or public.can_access_workspace_property(dependency.property_id))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('execute-evidence','execute-evidence',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf','text/plain']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Members read authorized Execute evidence objects" on storage.objects for select to authenticated using(bucket_id='execute-evidence' and exists(select 1 from public.platform_actions action where action.workspace_id=split_part(name,'/',1) and action.id=split_part(name,'/',2) and (action.property_id is null or public.can_access_workspace_property(action.property_id))));
create policy "Members upload authorized Execute evidence objects" on storage.objects for insert to authenticated with check(bucket_id='execute-evidence' and exists(select 1 from public.platform_actions action where action.workspace_id=split_part(name,'/',1) and action.id=split_part(name,'/',2) and (action.property_id is null or public.can_access_workspace_property(action.property_id))));

create or replace function public.apply_execute_action_control(
 p_workspace_id text,p_action_id text,p_expected_version integer,p_action_payload jsonb,
 p_evidence_upserts jsonb,p_blocker_upserts jsonb,p_dependency_upserts jsonb,p_dependency_deletes jsonb,
 p_activity_events jsonb,p_notification_intents jsonb
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare dependency_delete jsonb;result jsonb;
begin
 if not public.can_access_platform_action_workspace(p_workspace_id) then raise exception 'Execute workspace access denied' using errcode='42501';end if;
 perform 1 from public.platform_actions where workspace_id=p_workspace_id and id=p_action_id and version=p_expected_version and (property_id is null or public.can_access_workspace_property(property_id)) for update;
 if not found then raise exception 'Action version conflict or access denied' using errcode='40001';end if;
 if p_action_payload is not null then perform public.platform_action_replace(p_action_payload,p_expected_version);end if;
 insert into public.platform_action_evidence(workspace_id,id,action_id,evidence_type,storage_reference,reference_url,caption,original_filename,mime_type,file_size_bytes,created_by_id,created_at,review_status,reviewer_id,reviewed_at,rejection_reason,integrity_hash,administratively_removed_at,administratively_removed_by_id,submitted_at,superseded_by_id,metadata)
 select workspace_id,id,action_id,evidence_type,storage_reference,reference_url,caption,original_filename,mime_type,file_size_bytes,created_by_id,created_at,review_status,reviewer_id,reviewed_at,rejection_reason,integrity_hash,administratively_removed_at,administratively_removed_by_id,submitted_at,superseded_by_id,metadata from jsonb_populate_recordset(null::public.platform_action_evidence,coalesce(p_evidence_upserts,'[]'::jsonb))
 on conflict(workspace_id,id) do update set review_status=excluded.review_status,reviewer_id=excluded.reviewer_id,reviewed_at=excluded.reviewed_at,rejection_reason=excluded.rejection_reason,submitted_at=excluded.submitted_at,superseded_by_id=excluded.superseded_by_id,metadata=excluded.metadata;
 insert into public.platform_action_blockers(workspace_id,id,action_id,category,description,blocking_party,identified_at,expected_resolution_at,severity,resolution_note,resolved_by_id,resolved_at)
 select workspace_id,id,action_id,category,description,blocking_party,identified_at,expected_resolution_at,severity,resolution_note,resolved_by_id,resolved_at from jsonb_populate_recordset(null::public.platform_action_blockers,coalesce(p_blocker_upserts,'[]'::jsonb))
 on conflict(workspace_id,id) do update set category=excluded.category,description=excluded.description,blocking_party=excluded.blocking_party,expected_resolution_at=excluded.expected_resolution_at,severity=excluded.severity,resolution_note=excluded.resolution_note,resolved_by_id=excluded.resolved_by_id,resolved_at=excluded.resolved_at;
 insert into public.platform_action_dependencies(workspace_id,action_id,depends_on_action_id,created_by_id,created_at,override_reason,overridden_by_id,overridden_at)
 select workspace_id,action_id,depends_on_action_id,created_by_id,created_at,override_reason,overridden_by_id,overridden_at from jsonb_populate_recordset(null::public.platform_action_dependencies,coalesce(p_dependency_upserts,'[]'::jsonb))
 on conflict(workspace_id,action_id,depends_on_action_id) do update set override_reason=excluded.override_reason,overridden_by_id=excluded.overridden_by_id,overridden_at=excluded.overridden_at;
 for dependency_delete in select value from jsonb_array_elements(coalesce(p_dependency_deletes,'[]'::jsonb)) loop delete from public.platform_action_dependencies where workspace_id=p_workspace_id and action_id=dependency_delete->>'actionId' and depends_on_action_id=dependency_delete->>'dependsOnActionId';end loop;
 insert into public.platform_action_activity(workspace_id,id,entity_type,entity_id,action_id,event_type,actor_type,actor_id,occurred_at,metadata,correlation_id,causation_id) select workspace_id,id,entity_type,entity_id,action_id,event_type,actor_type,actor_id,occurred_at,metadata,correlation_id,causation_id from jsonb_populate_recordset(null::public.platform_action_activity,coalesce(p_activity_events,'[]'::jsonb));
 insert into public.execute_notification_outbox(workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at) select workspace_id,id,recipient_type,recipient_id,event_type,entity_type,entity_id,safe_template_variables,channel,delivery_status,idempotency_key,attempt_count,created_at from jsonb_populate_recordset(null::public.execute_notification_outbox,coalesce(p_notification_intents,'[]'::jsonb));
 select public.platform_action_find_by_id(p_workspace_id,p_action_id) into result;return result;
end;$$;
grant execute on function public.apply_execute_action_control(text,text,integer,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
commit;
