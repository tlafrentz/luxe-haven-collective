import type { UserRole } from "@/types/database";

type AdminRpcClient = {
  rpc(name: "is_admin"): PromiseLike<{
    data: boolean | null;
    error: unknown;
  }>;
};

export async function resolveAdminAccess(client: AdminRpcClient) {
  const { data, error } = await client.rpc("is_admin");
  return {
    authorized: error == null && data === true,
    available: error == null,
  } as const;
}

export function resolvedProfileRole(
  profileRole: UserRole | null | undefined,
  adminAuthorized: boolean,
): UserRole {
  return adminAuthorized ? "admin" : (profileRole ?? "guest");
}
