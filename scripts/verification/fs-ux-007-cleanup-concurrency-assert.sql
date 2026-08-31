\set ON_ERROR_STOP on
do $$declare m jsonb;begin
 select manifest->'fsux7' into m from public.fsux7_cleanup_manifests where installation_project_id='78000000-0000-4000-8000-000000000001';
 if(m->>'exceptions')::int<>1 or exists(select 1 from public.fsux7_tracking_exceptions where installation_project_id='78000000-0000-4000-8000-000000000001' and archived_at is null)or(select archived_at from public.furnishing_installation_projects where id='78000000-0000-4000-8000-000000000001')is null then raise exception 'FSUX7_CLEANUP_CONCURRENCY_RECONCILIATION_FAILED:%',m;end if;
end$$;
select 'FS_UX_007_CLEANUP_CONCURRENCY_PASS' as result;
