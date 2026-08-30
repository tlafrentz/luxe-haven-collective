\set ON_ERROR_STOP on
begin;
insert into public.notifications(workspace_id,recipient_profile_id,category,event_type,urgency,subject_type,subject_id,title,body,status,required,deduplication_key)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','operations','fixture_dependency','informational','furnishing_project','75000000-0000-4000-8000-000000000001','Concurrent dependency','Must block cleanup','unread',false,'cleanup-concurrency');
select pg_sleep(3);
commit;
