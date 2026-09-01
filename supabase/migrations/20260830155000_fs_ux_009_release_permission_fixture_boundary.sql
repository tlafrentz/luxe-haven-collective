-- FS-UX-009: minimum trusted fixture boundary for release permissions.
-- There is no release-permission write RPC. Controlled local provisioning and
-- cleanup use the service-role client; application actors remain read-only.
begin;

revoke all on table public.fsux8_release_permissions from anon, authenticated, service_role;
grant select on table public.fsux8_release_permissions to authenticated;
grant select, insert, delete on table public.fsux8_release_permissions to service_role;

-- The catalog lineage trigger creates this claim for the controlled anonymous
-- RLS canary. Cleanup must remove the claim before deleting that product.
revoke all on table public.furnishing_product_identity_claims from service_role;
grant select, delete on table public.furnishing_product_identity_claims to service_role;

commit;
