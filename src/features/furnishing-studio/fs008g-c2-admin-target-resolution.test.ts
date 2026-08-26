import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync("supabase/migrations/20260826010000_fs008g_c2_admin_target_resolution.sql","utf8");
const correction=readFileSync("supabase/migrations/20260826011000_fs008g_c2_atomic_wrapper_visibility.sql","utf8");
const repository=readFileSync("src/features/furnishing-studio/supabase-activation-command-repository.ts","utf8");

describe("FS-008G-C2 Admin target resolution",()=>{
 it("uses ordinary authenticated Admin identity and a target-scoped database boundary",()=>{expect(migration).toContain("auth.uid()");expect(migration).toContain("public.is_admin()");expect(migration).toContain("where id=target_uuid");expect(migration).toContain("where tenant_id=target_uuid");expect(repository).toContain("resolve_furnishing_activation_control");expect(repository).not.toContain("service_role")});
 it("distinguishes missing and forbidden targets and supports a version-zero first write",()=>{expect(migration).toContain("'status','not_found'");expect(migration).toContain("'status','forbidden'");expect(migration).toContain("'state','disabled','version',0");expect(repository).toContain('"NOT_FOUND"');expect(repository).toContain('"FORBIDDEN"');expect(repository).toContain('"VERSION_CONFLICT"')});
 it("requires the approved unexpired controlled tenant for read and commit",()=>{expect(migration.match(/PS001D_VERIFICATION_ONLY_NON_CUSTOMER/g)?.length).toBeGreaterThanOrEqual(2);expect(migration).toContain("expires_at>now()");expect(migration).toContain("apply_furnishing_activation_control_c2")});
 it("preserves the atomic version, idempotency, mutation and audit implementation",()=>{expect(migration).toContain("return public.apply_furnishing_activation_control(p_before,p_after,p_audit,p_fingerprint)");expect(repository).toContain("FURNISHING_ACTIVATION_IDEMPOTENCY_CONFLICT");expect(repository).toContain("apply_furnishing_activation_control_c2")});
 it("runs the target-scoped atomic eligibility check as a database-owned boundary",()=>{expect(correction).toContain("security definer");expect(migration).toContain("auth.uid()");expect(migration).toContain("public.is_admin()");expect(correction).toContain("grant execute");expect(correction).toContain("to authenticated")});
 it("does not change safe-disabled state or seed activation resources",()=>{expect(migration).not.toMatch(/insert into public\.furnishing_activation_(releases|workspaces|capabilities|audit_events)/);expect(migration).not.toMatch(/global_state\s*=\s*'internal'/);expect(migration).not.toMatch(/global_kill_switch\s*=\s*false/)});
});
