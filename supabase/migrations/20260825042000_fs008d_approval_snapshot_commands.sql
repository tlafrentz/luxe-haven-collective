-- FS-008D: governed approval and project snapshot commands on canonical FS-001/002 records.
create or replace function public.approve_furnishing_package_version(p_package_version_id uuid,p_expected_version integer,p_reason text,p_correlation_id text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v record; n integer;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'UNAUTHORIZED'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'REASON_REQUIRED'; end if;
 select * into v from public.furnishing_package_versions where id=p_package_version_id for update;
 if not found then raise exception 'PACKAGE_VERSION_NOT_FOUND'; end if;
 if v.lifecycle_status='approved' then return jsonb_build_object('status','replayed','id',v.id,'state',v.lifecycle_status); end if;
 if v.lifecycle_status not in('draft','in_review') then raise exception 'PACKAGE_VERSION_NOT_REVIEWABLE'; end if;
 select count(*) into n from public.furnishing_package_room_composition c where c.furnishing_package_version_id=v.id;
 if n=0 then raise exception 'PACKAGE_READINESS_INCOMPLETE'; end if;
 update public.furnishing_package_versions set lifecycle_status='approved',approved_at=now(),approved_by=auth.uid() where id=v.id;
 update public.furnishing_packages set lifecycle_status='approved',current_version_id=v.id where id=v.furnishing_package_id;
 return jsonb_build_object('status','approved','id',v.id,'state','approved');
end $$;

create or replace function public.create_furnishing_project_catalog_snapshot(p_project_id uuid,p_package_version_id uuid,p_snapshot jsonb,p_content_hash text,p_correlation_id text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; s record;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 select * into p from public.furnishing_projects where id=p_project_id for update;
 if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
 if not public.is_admin() and not exists(select 1 from public.customer_account_memberships m where m.profile_id=auth.uid() and m.tenant_id=p.workspace_id and m.status='active') then raise exception 'UNAUTHORIZED'; end if;
 select * into s from public.fs008d_project_catalog_snapshots where project_id=p.id and package_version_id=p_package_version_id for update;
 if found then if s.content_hash<>p_content_hash then raise exception 'SNAPSHOT_REPLAY_CONFLICT'; end if; return jsonb_build_object('status','replayed','id',s.id,'content_hash',s.content_hash); end if;
 if not exists(select 1 from public.furnishing_package_versions v where v.id=p_package_version_id and v.lifecycle_status='approved') then raise exception 'PACKAGE_NOT_APPROVED'; end if;
 insert into public.fs008d_project_catalog_snapshots(project_id,tenant_id,package_version_id,snapshot,content_hash,correlation_id) values(p.id,p.workspace_id,p_package_version_id,p_snapshot,p_content_hash,left(p_correlation_id,120)) returning * into s;
 return jsonb_build_object('status','created','id',s.id,'content_hash',s.content_hash);
end $$;
revoke all on function public.approve_furnishing_package_version(uuid,integer,text,text,text),public.create_furnishing_project_catalog_snapshot(uuid,uuid,jsonb,text,text,text) from public,anon;
grant execute on function public.approve_furnishing_package_version(uuid,integer,text,text,text),public.create_furnishing_project_catalog_snapshot(uuid,uuid,jsonb,text,text,text) to authenticated;
