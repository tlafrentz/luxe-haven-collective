import { createClient } from "@/lib/supabase/server";

type SyncAuthorizationResult =
  | {
      authorized: true;
      method: "secret" | "admin";
      userId?: string;
    }
  | {
      authorized: false;
      reason: "unauthenticated" | "forbidden";
    };

function hasValidSyncSecret(
  request: Request,
): boolean {
  const expectedSecret =
    process.env.HOSPITABLE_SYNC_SECRET;

  if (!expectedSecret) {
    return false;
  }

  const authorization =
    request.headers.get("authorization");

  return (
    authorization ===
    `Bearer ${expectedSecret}`
  );
}

export async function authorizeHospitableSyncRequest(
  request: Request,
): Promise<SyncAuthorizationResult> {
  if (hasValidSyncSecret(request)) {
    return {
      authorized: true,
      method: "secret",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false,
      reason: "unauthenticated",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    profileError ||
    profile?.role !== "admin"
  ) {
    return {
      authorized: false,
      reason: "forbidden",
    };
  }

  return {
    authorized: true,
    method: "admin",
    userId: user.id,
  };
}
