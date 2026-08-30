\set ON_ERROR_STOP on
begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000002','authenticated','authenticated','fs008g-other-owner@example.invalid',crypt('local-only',gen_salt('bf')),now(),'{}','{"full_name":"Other owner","role":"owner"}',now(),now());
insert into public.owners(id,profile_id,company_name) values('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','FS008G other workspace');
insert into public.ps001d_verification_tenants(tenant_id,designation,status,approved_by,expires_at,relationship_attestation)
values
('20000000-0000-4000-8000-000000000001','PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved','10000000-0000-4000-8000-000000000001',now()+interval '1 day','{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}'),
('20000000-0000-4000-8000-000000000002','PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved','10000000-0000-4000-8000-000000000001',now()+interval '1 day','{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}');
update public.furnishing_activation_releases set global_state='internal',global_kill_switch=false,configuration_valid=true where milestone='FS-008A';
insert into public.furnishing_activation_workspaces(release_id,workspace_id,enabled,kill_switch,cohort,expires_at,approved_by,reason)
select id,w,true,false,'internal',now()+interval '1 day','10000000-0000-4000-8000-000000000001','local identity rehearsal'
from public.furnishing_activation_releases cross join unnest(array['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid]) w where milestone='FS-008A';
insert into public.furnishing_activation_capabilities(release_id,capability,enabled)
select id,'catalog_viewing',true from public.furnishing_activation_releases where milestone='FS-008A'
on conflict(release_id,capability) do update set enabled=true;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

insert into public.furnishing_products(id,scope,workspace_id,name,product_type,category,status,created_by,color)
values
('50000000-0000-4000-8000-000000000001','platform',null,'Canonical Chair','catalog_item','Seating','draft','10000000-0000-4000-8000-000000000001','black'),
('50000000-0000-4000-8000-000000000002','platform',null,'Adopted Lamp','catalog_item','Lighting','draft','10000000-0000-4000-8000-000000000001',null),
('50000000-0000-4000-8000-000000000003','workspace','20000000-0000-4000-8000-000000000001','Canonical Chair','catalog_item','Seating','draft','10000000-0000-4000-8000-000000000001','black');

do $$begin
 begin perform public.adopt_furnishing_platform_product(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','source_product_id','50000000-0000-4000-8000-000000000001','workspace_overrides','{}'::jsonb,'correlation_id','60000000-0000-4000-8000-000000000001','idempotency_key','identity-manual-adoption-conflict'));raise exception 'EXPECTED_ADOPTION_MANUAL_CONFLICT';exception when others then if sqlerrm not like '%CATALOG_WORKSPACE_IDENTITY_CONFLICT%' then raise;end if;end;
 if exists(select 1 from public.furnishing_product_adoptions where source_product_id='50000000-0000-4000-8000-000000000001') then raise exception 'FAILED_ADOPTION_RETAINED_LINEAGE';end if;
 if (select count(*) from public.furnishing_product_identity_claims where workspace_id='20000000-0000-4000-8000-000000000001')<>1 then raise exception 'FAILED_ADOPTION_RETAINED_CLAIM';end if;
end$$;

do $$declare first_result jsonb;replay jsonb;existing jsonb;adopted uuid;begin
 first_result:=public.adopt_furnishing_platform_product(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','source_product_id','50000000-0000-4000-8000-000000000002','workspace_overrides','{}'::jsonb,'correlation_id','60000000-0000-4000-8000-000000000002','idempotency_key','identity-adoption-idempotency-0001'));
 adopted:=(first_result->>'workspaceProductId')::uuid;
 replay:=public.adopt_furnishing_platform_product(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','source_product_id','50000000-0000-4000-8000-000000000002','workspace_overrides','{}'::jsonb,'correlation_id','60000000-0000-4000-8000-000000000002','idempotency_key','identity-adoption-idempotency-0001'));
 existing:=public.adopt_furnishing_platform_product(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','source_product_id','50000000-0000-4000-8000-000000000002','workspace_overrides','{}'::jsonb,'correlation_id','60000000-0000-4000-8000-000000000003','idempotency_key','identity-adoption-idempotency-0002'));
 if first_result->>'status'<>'adopted' or replay->>'status'<>'replayed' or existing->>'status'<>'existing' or replay->>'workspaceProductId'<>adopted::text or existing->>'workspaceProductId'<>adopted::text then raise exception 'ADOPTION_IDEMPOTENCY_FAILED';end if;
 if (select count(*) from public.furnishing_products where workspace_id='20000000-0000-4000-8000-000000000001' and family_product_id='50000000-0000-4000-8000-000000000002')<>1 then raise exception 'DUPLICATE_ADOPTION_CREATED';end if;
end$$;

do $$begin
 begin insert into public.furnishing_products(scope,workspace_id,name,product_type,category,status,created_by) values('workspace','20000000-0000-4000-8000-000000000001','Adopted Lamp','catalog_item','Lighting','draft','10000000-0000-4000-8000-000000000001');raise exception 'EXPECTED_MANUAL_ADOPTION_CONFLICT';exception when others then if sqlerrm not like '%CATALOG_WORKSPACE_IDENTITY_CONFLICT%' then raise;end if;end;
 if (select count(*) from public.furnishing_products where workspace_id='20000000-0000-4000-8000-000000000001' and name='Adopted Lamp')<>1 then raise exception 'FAILED_MANUAL_INSERT_RETAINED_PRODUCT';end if;
end$$;

insert into public.furnishing_products(id,scope,workspace_id,name,product_type,category,status,created_by,color)
values
('50000000-0000-4000-8000-000000000010','workspace','20000000-0000-4000-8000-000000000001','Variant Sofa','catalog_item','Seating','draft','10000000-0000-4000-8000-000000000001','navy'),
('50000000-0000-4000-8000-000000000011','workspace','20000000-0000-4000-8000-000000000001','Variant Sofa','catalog_item','Seating','draft','10000000-0000-4000-8000-000000000001','ivory'),
('50000000-0000-4000-8000-000000000012','workspace','20000000-0000-4000-8000-000000000002','Variant Sofa','catalog_item','Seating','draft','10000000-0000-4000-8000-000000000001','navy'),
('50000000-0000-4000-8000-000000000013','workspace','20000000-0000-4000-8000-000000000001','Parallel Navy Sofa','catalog_item','Seating','draft','10000000-0000-4000-8000-000000000001','navy');

insert into public.furnishing_retailers(id,name,website_url,status) values
('70000000-0000-4000-8000-000000000001','Identity Retailer A','https://retailer-a.invalid','active'),
('70000000-0000-4000-8000-000000000002','Identity Retailer B','https://retailer-b.invalid','active');
insert into public.furnishing_product_offers(product_id,workspace_id,retailer_id,sku,product_url,currency,status)
values
('50000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','SKU-ONE','https://retailer-a.invalid/one','USD','active'),
('50000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','SKU-ONE','https://retailer-b.invalid/one','USD','active'),
('50000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','SKU-ONE','https://retailer-a.invalid/ivory','USD','active');
do $$begin
 begin insert into public.furnishing_product_offers(product_id,workspace_id,retailer_id,sku,product_url,currency,status) values('50000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','SKU-ONE','https://retailer-a.invalid/parallel','USD','active');raise exception 'EXPECTED_OFFER_IDENTITY_CONFLICT';exception when others then if sqlerrm not like '%CATALOG_RETAILER_SKU_IDENTITY_CONFLICT%' then raise;end if;end;
 if (select count(*) from public.furnishing_product_offers where product_id='50000000-0000-4000-8000-000000000013')<>0 then raise exception 'FAILED_OFFER_RETAINED';end if;
end$$;

do $$declare adopted uuid;proposal uuid;result jsonb;claim_before text;claim_after text;begin
 select workspace_product_id into adopted from public.furnishing_product_adoptions where source_product_id='50000000-0000-4000-8000-000000000002';
 update public.furnishing_products set status='approved' where id=adopted;
 select identity_key into claim_before from public.furnishing_product_identity_claims where product_id=adopted and identity_kind='platform_source';
 result:=public.edit_furnishing_product(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','product_id',adopted,'expected_revision',1,'correlation_id','60000000-0000-4000-8000-000000000004','idempotency_key','identity-revision-proposal-0001','reason','Governed identity revision','changes',jsonb_build_object('name','Adopted Lamp Revised','description',null,'brand',null,'category_id',null,'color',null,'material',null,'finish',null,'assembly_required',null)));
 proposal:=(result->>'proposalId')::uuid;
 perform public.approve_furnishing_product_revision(jsonb_build_object('workspace_id','20000000-0000-4000-8000-000000000001','product_id',adopted,'proposal_id',proposal,'expected_revision',1,'correlation_id','60000000-0000-4000-8000-000000000005','idempotency_key','identity-revision-approval-0001','reason','Approve governed revision'));
 select identity_key into claim_after from public.furnishing_product_identity_claims where product_id=adopted and identity_kind='platform_source';
 if claim_after is distinct from claim_before or not exists(select 1 from public.furnishing_product_versions where id=proposal and lifecycle_status='approved') then raise exception 'REVISION_IDENTITY_OWNERSHIP_FAILED';end if;
 update public.furnishing_products set status='discontinued' where id=adopted;
 begin insert into public.furnishing_products(scope,workspace_id,name,product_type,category,status,created_by) values('workspace','20000000-0000-4000-8000-000000000001','Adopted Lamp Revised','catalog_item','Lighting','draft','10000000-0000-4000-8000-000000000001');raise exception 'EXPECTED_RETIRED_IDENTITY_BLOCK';exception when others then if sqlerrm not like '%CATALOG_RETIRED_IDENTITY_REQUIRES_REPLACEMENT%' then raise;end if;end;
end$$;

do $$begin
 if exists(select 1 from public.furnishing_product_identity_claims group by workspace_id,identity_kind,identity_key having count(*)>1) then raise exception 'DUPLICATE_IDENTITY_CLAIM';end if;
 if exists(select 1 from public.furnishing_product_identity_claims c left join public.furnishing_products p on p.id=c.product_id where p.id is null) then raise exception 'ORPHAN_IDENTITY_CLAIM';end if;
end$$;
commit;
select 'FS008G_IDENTITY_NEGATIVE_MATRIX_PASS' as result;
