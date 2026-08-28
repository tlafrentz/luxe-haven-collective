-- FS-008G forward repair: compare canonical profile role enum as text.
begin;
create or replace function public.issue_fs008g_furnishing_command_context(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_context public.furnishing_command_contexts%rowtype;v_actor uuid:=(p_input->>'actorId')::uuid;v_workspace uuid:=(p_input->>'workspaceId')::uuid;v_expires timestamptz:=(p_input->>'expiresAt')::timestamptz;v_binding text;
begin
 if not exists(select 1 from public.profiles profile_row where profile_row.id=v_actor and profile_row.role::text=p_input->>'actorRole') then raise exception 'FS008G_CONTEXT_ACTOR_INVALID';end if;
 if v_expires<=now() or v_expires>now()+interval '2 hours' then raise exception 'FS008G_CONTEXT_EXPIRY_INVALID';end if;
 v_binding:=pg_catalog.encode(extensions.digest(pg_catalog.concat_ws(':',p_input->>'candidateCommit',p_input->>'workflow',v_workspace::text,v_actor::text,p_input->>'commandType',p_input->>'targetType',p_input->>'targetId'),'sha256'),'hex');
 select context_row.* into v_context from public.furnishing_command_contexts context_row where context_row.binding_hash=v_binding for update;
 if found then
  if v_context.retired_at is not null then raise exception 'FS008G_CONTEXT_RETIRED';end if;
  update public.furnishing_command_contexts context_row set expires_at=v_expires,refreshed_at=now() where context_row.id=v_context.id returning context_row.* into v_context;
 else
  insert into public.furnishing_command_contexts(candidate_commit,workflow,workspace_id,actor_id,actor_role,command_type,target_type,target_id,idempotency_key,binding_hash,expires_at) values(p_input->>'candidateCommit',p_input->>'workflow',v_workspace,v_actor,p_input->>'actorRole',p_input->>'commandType',p_input->>'targetType',p_input->>'targetId','fs008g-ctx-'||v_binding,v_binding,v_expires) returning * into v_context;
 end if;
 return jsonb_build_object('contextId',v_context.id,'expiresAt',v_context.expires_at);
end $$;
revoke all on function public.issue_fs008g_furnishing_command_context(jsonb) from public,anon,authenticated;
grant execute on function public.issue_fs008g_furnishing_command_context(jsonb) to service_role;
commit;
