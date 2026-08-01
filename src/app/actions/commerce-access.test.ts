import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCommerceAccessWorkspace } from "./commerce-access";

type Result = { data: unknown; error: { message: string } | null };

function clientWith(results: Record<string, Result>) {
  const calls: Record<string, string[]> = {};
  const from = vi.fn((table: string) => {
    calls[table] = [];
    const builder: Record<string, (...args: unknown[]) => unknown> & PromiseLike<Result> = {
      then(resolve, reject) { return Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject); },
    } as Record<string, (...args: unknown[]) => unknown> & PromiseLike<Result>;
    for (const method of ["select", "eq", "or", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls[table].push(`${method}:${args.map(String).join("|")}`);
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(results[table] ?? { data: null, error: null });
    return builder;
  });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "profile-1" } } }) },
    from,
    calls,
  };
}

describe("getCommerceAccessWorkspace", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns intentional empty access when the Commerce customer is missing", async () => {
    const client = clientWith({ commerce_customers: { data: null, error: null } });
    createClient.mockResolvedValue(client);
    await expect(getCommerceAccessWorkspace({ workspaceId: "workspace-1" })).resolves.toMatchObject({
      entitlements: [],
      version: "0",
    });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("keeps a database failure distinguishable from legitimate lack of access", async () => {
    createClient.mockResolvedValue(clientWith({
      commerce_customers: { data: { id: "customer-1", workspace_id: "workspace-1" }, error: null },
      commerce_entitlement_grants: { data: null, error: { message: "database unavailable" } },
    }));
    await expect(getCommerceAccessWorkspace({ workspaceId: "workspace-1" })).rejects.toThrow(
      "commerce_access_query_failed:database unavailable",
    );
  });

  it("queries live workspace, profile, and actual property scope", async () => {
    const client = clientWith({
      commerce_customers: { data: { id: "customer-1", workspace_id: "stale-workspace" }, error: null },
    });
    createClient.mockResolvedValue(client);
    await getCommerceAccessWorkspace({ workspaceId: "workspace-1", propertyId: "property-1" });
    expect(client.calls.commerce_entitlement_grants).toContain(
      "or:profile_id.eq.profile-1,workspace_id.eq.workspace-1,property_id.eq.property-1",
    );
    expect(client.calls.commerce_entitlement_grants).toContain("eq:environment|live");
  });
});
