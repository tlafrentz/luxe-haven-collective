"use server";
import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  advanceControlledJourney,
  authorizeControlledJourneyActor,
  CONTROLLED_JOURNEY_OPERATION,
  CONTROLLED_STAGES,
} from "@/features/guidebook-creation-assistant/controlled-journey";

const path = "/admin/guidebooks/controlled-extraction-verification",
  selection = z.object({
    customerAccountId: z.string().uuid(),
    entitlementId: z.string().uuid(),
  });
async function actor() {
  const auth = await requireRole(["admin"]);
  if (!(await authorizeControlledJourneyActor(auth.user.id)))
    throw new Error("CONTROLLED_EXTRACTION_CAPABILITY_REQUIRED");
  return auth;
}

export async function getControlledExtractionLaunchProjection() {
  await actor();
  const db = await createClient(),
    supportId = crypto.randomUUID(),
    { data, error } = await db.rpc(
      "get_controlled_extraction_launch_projection",
    );
  if (error) {
    console.error("CONTROLLED_EXTRACTION_PROJECTION_FAILED", {
      supportId,
      stage: "canonical_projection_rpc",
      code: error.code ?? "unknown",
    });
    return {
      customers: [],
      launch: null,
      emptyReason: `The authorized Admin projection failed. Support ID: ${supportId}`,
    };
  }
  const value = (data ?? {}) as {
      customers?: unknown[];
      launch?: {
        status: unknown;
        correlation_id: unknown;
        created_at: unknown;
        closed_at: unknown;
      } | null;
    },
    customers = (value.customers ?? []) as {
      id: string;
      name: string;
      entitlements: {
        id: string;
        label: string;
        effectiveUntil: string | null;
      }[];
    }[],
    launch = value.launch,
    emptyReason = !customers.length
      ? "No active controlled verification customer is registered for PV-009."
      : customers.some((customer) => customer.entitlements.length)
        ? null
        : "Controlled customers are active, but no active, unexpired, unrevoked, unallocated Guidebook grant is eligible.";
  return {
    customers,
    launch: launch
      ? {
          status: String(launch.status),
          correlationId: String(launch.correlation_id),
          createdAt: String(launch.created_at),
          closedAt: launch.closed_at ? String(launch.closed_at) : null,
        }
      : null,
    emptyReason,
  };
}

export async function launchControlledExtractionAction(form: FormData) {
  const { user } = await actor(),
    parsed = selection.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) redirect(`${path}?result=invalid-selection`);
  const db = createAdminClient(),
    now = new Date().toISOString(),
    customer = await db
      .from("customer_accounts")
      .select("id,tenant_id,status")
      .eq("id", parsed.data.customerAccountId)
      .eq("status", "active")
      .single(),
    identity = await db
      .from("controlled_verification_identities")
      .select("id")
      .eq("environment_code", "production")
      .eq("identity_type_code", "guidebook_customer")
      .eq("customer_account_id", parsed.data.customerAccountId)
      .eq("status", "active")
      .contains("allowed_scenario_codes", ["PV-009"])
      .maybeSingle(),
    grant = await db
      .from("commercial_entitlements")
      .select(
        "id,tenant_id,customer_account_id,capability_code,status,effective_from,effective_until,resource_scope_type,resource_scope_id",
      )
      .eq("id", parsed.data.entitlementId)
      .single();
  if (
    !customer.data ||
    !identity.data ||
    !grant.data ||
    grant.data.tenant_id !== customer.data.tenant_id ||
    grant.data.customer_account_id !== customer.data.id ||
    grant.data.capability_code !== "guidebook.property.create_standalone" ||
    grant.data.status !== "active" ||
    grant.data.resource_scope_type !== "customer_account" ||
    grant.data.resource_scope_id !== customer.data.id ||
    String(grant.data.effective_from) > now ||
    (grant.data.effective_until && String(grant.data.effective_until) <= now)
  )
    redirect(`${path}?result=ineligible`);
  const reserved = await db
    .from("property_entitlement_allocations")
    .select("id")
    .eq("entitlement_id", grant.data.id)
    .eq("status", "reserved")
    .maybeSingle();
  if (reserved.data) redirect(`${path}?result=grant-already-allocated`);
  const candidate = await db
      .from("production_release_candidates")
      .select("id")
      .eq("environment_code", "production")
      .order("deployed_at", { ascending: false })
      .limit(1)
      .single(),
    reviewer = await db
      .from("controlled_verification_identities")
      .select("opaque_auth_subject_reference")
      .eq("environment_code", "production")
      .eq("identity_type_code", "release_reviewer")
      .eq("status", "active")
      .neq("opaque_auth_subject_reference", user.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(1)
      .single();
  if (!candidate.data || !reviewer.data)
    redirect(`${path}?result=verification-context-unavailable`);
  const correlationId = crypto.randomUUID(),
    created = await db.rpc("create_ca001f_verification_run", {
      p_candidate_id: candidate.data.id,
      p_actor_id: user.id,
      p_reviewer_id: reviewer.data.opaque_auth_subject_reference,
      p_correlation_id: correlationId,
      p_instances: [
        {
          scenario_code: "PV-009",
          scenario_version: 1,
          expected_outcome_code: "CONTROLLED_GUIDEBOOK_DRAFT_VERIFIED",
        },
      ],
    });
  if (created.error || !created.data)
    redirect(`${path}?result=run-create-failed`);
  const run = created.data as Record<string, unknown>,
    armed = await db.from("guidebook_controlled_extraction_launches").insert({
      operation_code: CONTROLLED_JOURNEY_OPERATION,
      verification_run_id: String(run.id),
      actor_id: user.id,
      customer_account_id: customer.data.id,
      entitlement_id: grant.data.id,
      status: "armed",
      correlation_id: correlationId,
    });
  if (armed.error) redirect(`${path}?result=already-claimed`);
  await db
    .from("guidebook_controlled_extraction_launches")
    .update({ status: "running" })
    .eq("verification_run_id", run.id)
    .eq("status", "armed");
  let succeededCorrelation: string | null = null,
    failedCode: string | null = null;
  try {
    let result = await advanceControlledJourney({
      actorId: user.id,
      authenticated: await createClient(),
      command: {
        expectedStage: "not_started",
        verificationRunId: String(run.id),
        customerAccountId: customer.data.id,
        entitlementId: grant.data.id,
      },
    });
    while (result.stage !== "completed") {
      if (!CONTROLLED_STAGES.includes(result.stage))
        throw new Error("CONTROLLED_EXTRACTION_STATE_INVALID");
      result = await advanceControlledJourney({
        actorId: user.id,
        authenticated: await createClient(),
        command: { expectedStage: result.stage },
      });
    }
    await db
      .from("guidebook_controlled_extraction_launches")
      .update({
        status: "closed_succeeded",
        closed_at: new Date().toISOString(),
      })
      .eq("verification_run_id", run.id)
      .eq("status", "running");
    succeededCorrelation = result.correlationId;
  } catch (error) {
    failedCode = safeActionCode(error);
    console.error("controlled_extraction.launch_failed", {
      correlationId,
      code: failedCode,
    });
    await db
      .from("guidebook_controlled_extraction_launches")
      .update({ status: "cleanup_required" })
      .eq("verification_run_id", run.id)
      .eq("status", "running");
    try {
      await advanceControlledJourney({
        actorId: user.id,
        authenticated: await createClient(),
        command: { action: "cleanup" },
      });
      await db
        .from("guidebook_controlled_extraction_launches")
        .update({
          status: "closed_failed",
          closed_at: new Date().toISOString(),
        })
        .eq("verification_run_id", run.id)
        .eq("status", "cleanup_required");
    } catch (cleanupError) {
      console.error("controlled_extraction.cleanup_failed", {
        correlationId,
        code: safeActionCode(cleanupError),
      });
    }
  }
  if (succeededCorrelation)
    redirect(
      `${path}?result=succeeded&correlation=${encodeURIComponent(succeededCorrelation)}`,
    );
  redirect(
    `${path}?result=failed&failure=${encodeURIComponent(failedCode ?? "CONTROLLED_EXTRACTION_FAILED")}`,
  );
}

export async function cleanupControlledExtractionAction() {
  const { user } = await actor(),
    db = createAdminClient(),
    { data: launch } = await db
      .from("guidebook_controlled_extraction_launches")
      .select(
        "verification_run_id,status,customer_account_id,entitlement_id",
      )
      .eq("operation_code", CONTROLLED_JOURNEY_OPERATION)
      .eq("actor_id", user.id)
      .in("status", ["running", "cleanup_required"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  if (!launch) redirect(`${path}?result=cleanup-not-required`);
  let cleaned = false,
    cleanupFailure = "CONTROLLED_CLEANUP_FAILED";
  try {
    await advanceControlledJourney({
      actorId: user.id,
      authenticated: await createClient(),
      command: { action: "cleanup" },
    });
    await db
      .from("guidebook_controlled_extraction_launches")
      .update({ status: "closed_failed", closed_at: new Date().toISOString() })
      .eq("verification_run_id", launch.verification_run_id)
      .in("status", ["running", "cleanup_required"]);
    cleaned = true;
  } catch (error) {
    cleanupFailure = safeActionCode(error);
  }
  if (!cleaned)
    redirect(
      `${path}?result=cleanup-blocked&failure=${encodeURIComponent(cleanupFailure)}`,
    );
  const retry = new FormData();
  retry.set("customerAccountId", String(launch.customer_account_id));
  retry.set("entitlementId", String(launch.entitlement_id));
  return launchControlledExtractionAction(retry);
}

function safeActionCode(error: unknown) {
  const structured =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "",
    value = /^[A-Z][A-Z0-9_]{2,100}$/.test(structured)
      ? structured
      : error instanceof Error
        ? error.message
        : "CONTROLLED_EXTRACTION_FAILED";
  return /^[A-Z][A-Z0-9_]{2,100}$/.test(value)
    ? value
    : "CONTROLLED_EXTRACTION_FAILED";
}
