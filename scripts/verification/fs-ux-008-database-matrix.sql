\set ON_ERROR_STOP on
begin;
do $$
declare r uuid; w uuid:='20000000-0000-4000-8000-000000000001'; admin_id uuid:='10000000-0000-4000-8000-000000000001'; c record; result jsonb; before_events bigint; after_events bigint;
begin
 select id into r from public.furnishing_activation_releases where milestone='FS-008A' order by updated_at desc limit 1;
 update public.furnishing_activation_workspaces set enabled=true,kill_switch=false,cohort='internal',expires_at=now()+interval '1 day',revoked_at=null where release_id=r and workspace_id=w;
 delete from public.furnishing_activation_capabilities where release_id=r and capability=any(array['catalog_viewing','design_workspace','budgeting','procurement_readiness']);
 insert into public.furnishing_activation_capabilities(release_id,capability,enabled) select r,value,false from unnest(array['catalog_viewing','design_workspace','budgeting','procurement_readiness']) value;
 begin update public.furnishing_activation_capabilities set enabled=true where release_id=r and capability='design_workspace'; raise exception 'out-of-order enable unexpectedly succeeded'; exception when raise_exception then if sqlerrm not like '%PREREQUISITE_INCOMPLETE%' then raise; end if; end;
 update public.furnishing_activation_capabilities set enabled=true where release_id=r and capability='catalog_viewing';
 perform set_config('request.jwt.claim.sub',admin_id::text,true); perform set_config('request.jwt.claim.role','authenticated',true);
 select count(*) into before_events from public.furnishing_activation_audit_events;
 result:=public.verify_furnishing_release_capability(w,'catalog_viewing',1,'Database verification of bounded catalog access','fsux8-db-correlation','fsux8-db-idempotency',true);
 if result->>'verification'<>'verified' then raise exception 'verification failed'; end if;
 select count(*) into after_events from public.furnishing_activation_audit_events;
 if after_events<>before_events+1 then raise exception 'audit persistence mismatch'; end if;
 if public.verify_furnishing_release_capability(w,'catalog_viewing',1,'Database verification of bounded catalog access','fsux8-db-correlation','fsux8-db-idempotency',true)<>result then raise exception 'replay mismatch'; end if;
 update public.furnishing_activation_capabilities set enabled=true where release_id=r and capability='design_workspace';
 begin update public.furnishing_activation_capabilities set enabled=false where release_id=r and capability='catalog_viewing'; raise exception 'forward rollback unexpectedly succeeded'; exception when raise_exception then if sqlerrm not like '%DEPENDENT_ACTIVE%' then raise; end if; end;
 update public.furnishing_activation_capabilities set enabled=false where release_id=r and capability='design_workspace';
 update public.furnishing_activation_capabilities set enabled=false where release_id=r and capability='catalog_viewing';
 for c in select * from public.furnishing_activation_capabilities where release_id=r and capability=any(array['catalog_viewing','design_workspace','budgeting','procurement_readiness']) loop if c.enabled or c.verification_state<>'unverified' then raise exception 'rollback did not restore safe capability state'; end if; end loop;
end $$;
rollback;
select 'FSUX8_DATABASE_MATRIX_OK';
