\set ON_ERROR_STOP on
do $$begin
 if (select count(*) from public.furnishing_products where scope='platform' and workspace_id is null and status='draft')<>109 then raise exception 'EXPECTED_109_PLATFORM_DRAFTS';end if;
 if exists(select 1 from public.furnishing_products where scope='workspace') then raise exception 'MIGRATION_MANUFACTURED_WORKSPACE_PRODUCT';end if;
 if (select count(*) from public.furnishing_packages where governance_scope='legacy_ambiguous' and workspace_id is null and lifecycle_status='draft' and current_version_id is null)<>3 then raise exception 'LEGACY_PACKAGE_CLASSIFICATION_MISMATCH';end if;
 if exists(select 1 from public.furnishing_packages where governance_scope='legacy_ambiguous' and id not in('4d162594-f9a7-45e9-881e-adba36cd7406','c196e39c-5d10-4f9a-a8ea-48045da3fa10','a7e0d9cd-3f94-4ccb-9be4-c218bd0a1a96')) then raise exception 'UNAPPROVED_LEGACY_CLASSIFICATION';end if;
end$$;
do $$declare replay jsonb;begin
 replay:=public.apply_fs008g_c7_catalog_import(jsonb_build_object('actorId','10000000-0000-4000-8000-000000000001','importId','30000000-0000-4000-8000-000000000001','workspaceId','20000000-0000-4000-8000-000000000001','expectedVersion',0,'correlationId','40000000-0000-4000-8000-000000000001','idempotencyKey','production-derived-apply-idempotency'));
 if replay->>'status'<>'replayed' or (replay->>'created')::int<>109 then raise exception 'IMPORT_REPLAY_INVALID';end if;
end$$;
do $$begin
 if has_function_privilege('authenticated','public.cleanup_fs008g_synthetic_project(jsonb)','execute') then raise exception 'AUTHENTICATED_CLEANUP_EXECUTE_PRESENT';end if;
 if has_function_privilege('anon','public.cleanup_fs008g_synthetic_project(jsonb)','execute') then raise exception 'ANON_CLEANUP_EXECUTE_PRESENT';end if;
 if not has_function_privilege('service_role','public.cleanup_fs008g_synthetic_project(jsonb)','execute') then raise exception 'SERVICE_CLEANUP_EXECUTE_MISSING';end if;
 if has_function_privilege('authenticated','public.apply_fs008g_c7_catalog_import(jsonb)','execute') then raise exception 'AUTHENTICATED_IMPORT_EXECUTE_PRESENT';end if;
end$$;
select 'FS008G_PRODUCTION_CEILING_SEQUENCE_PASS' as result;
