begin;
do $$
declare definition text;corrected text;
 prior_predicate constant text:='w.profile_id=p_admin_id';
 controlled_predicate constant text:='exists(select 1 from public.profiles wrong_owner join auth.users wrong_identity on wrong_identity.id=wrong_owner.id where wrong_owner.id=w.profile_id and wrong_owner.role=''owner'' and wrong_owner.email like ''fs008g-c8-wrong-%@example.invalid'' and wrong_identity.deleted_at is null and (wrong_identity.banned_until is null or wrong_identity.banned_until<=now()))';
begin
 select pg_get_functiondef('public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)'::regprocedure) into definition;
 if definition is null or strpos(definition,prior_predicate)=0 then raise exception 'FS008G_CLEANUP_WRONG_WORKSPACE_POLICY_SOURCE_DRIFT';end if;
 corrected:=replace(definition,prior_predicate,controlled_predicate);
 if corrected=definition then raise exception 'FS008G_CLEANUP_WRONG_WORKSPACE_POLICY_NOT_CORRECTED';end if;
 execute corrected;
end $$;
revoke all on function public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid) to service_role;
commit;
