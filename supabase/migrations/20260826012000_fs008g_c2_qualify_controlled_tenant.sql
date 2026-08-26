-- FS-008G-C2 correction: qualify the controlled-tenant column so PL/pgSQL
-- cannot confuse it with the wrapper's tenant_id input variable.
begin;

create or replace function public.apply_furnishing_activation_control_c2(p_before jsonb,p_after jsonb,p_audit jsonb,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare target text:=p_after->>'target'; target_id text:=p_after->>'targetId'; tenant_id text:=p_after->>'tenantId'; controlled_tenant uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'FURNISHING_ACTIVATION_ADMIN_REQUIRED' using errcode='42501'; end if;
 if target in('workspace','cohort') then
  if tenant_id is distinct from target_id then raise exception 'FURNISHING_ACTIVATION_FORBIDDEN' using errcode='42501'; end if;
  begin controlled_tenant:=target_id::uuid; exception when invalid_text_representation then raise exception 'FURNISHING_ACTIVATION_NOT_FOUND'; end;
 elsif target='capability' then
  if tenant_id is null then raise exception 'FURNISHING_ACTIVATION_FORBIDDEN' using errcode='42501'; end if;
  begin controlled_tenant:=tenant_id::uuid; exception when invalid_text_representation then raise exception 'FURNISHING_ACTIVATION_NOT_FOUND'; end;
 end if;
 if controlled_tenant is not null then
  if not exists(select 1 from public.owners o where o.id=controlled_tenant) then raise exception 'FURNISHING_ACTIVATION_NOT_FOUND'; end if;
  if not exists(select 1 from public.ps001d_verification_tenants v where v.tenant_id=controlled_tenant and v.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and v.status='approved' and v.revoked_at is null and v.expires_at>now()) then raise exception 'FURNISHING_ACTIVATION_FORBIDDEN' using errcode='42501'; end if;
 end if;
 return public.apply_furnishing_activation_control(p_before,p_after,p_audit,p_fingerprint);
end $$;

revoke all on function public.apply_furnishing_activation_control_c2(jsonb,jsonb,jsonb,text) from public,anon;
grant execute on function public.apply_furnishing_activation_control_c2(jsonb,jsonb,jsonb,text) to authenticated;

commit;
