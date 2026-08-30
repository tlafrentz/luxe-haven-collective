\set ON_ERROR_STOP on
do $$begin
 if (select lifecycle_status from public.furnishing_projects where id='75000000-0000-4000-8000-000000000001')<>'draft'
   or (select status from public.furnishing_plans where id='76000000-0000-4000-8000-000000000001')<>'draft'
   or exists(select 1 from public.furnishing_cleanup_runs where project_id='75000000-0000-4000-8000-000000000001')
   or not exists(select 1 from public.notifications where subject_id='75000000-0000-4000-8000-000000000001')
 then raise exception 'FS008G_CLEANUP_CONCURRENCY_ATOMICITY_FAILED';end if;
end$$;
select 'FS008G_CLEANUP_CONCURRENCY_PASS' as result;
