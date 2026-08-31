\set ON_ERROR_STOP on
begin;
insert into public.fsux7_tracking_exceptions(installation_project_id,category,severity,description,required_resolution,status,evidence)values('78000000-0000-4000-8000-000000000001','concurrent_controlled_test','informational','Concurrent controlled evidence','Archive exact locked set','resolved','{}');
select pg_sleep(3);
commit;
