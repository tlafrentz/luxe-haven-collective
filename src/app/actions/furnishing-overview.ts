"use server";
import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = Record<string, unknown>;
const activeProjectStates = ["draft", "planning", "designing", "awaiting_approval", "approved", "procuring", "installing", "launch_review"];
export async function getFurnishingOverview(workspaceId?: string) {
  await requireRole(["admin"]);
  const db = createAdminClient(), validWorkspace = workspaceId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(workspaceId) ? workspaceId : null;
  let workspaceProductQuery = db.from("furnishing_products").select("id", { count: "exact", head: true }).eq("scope", "workspace").neq("status", "archived");
  let reviewQuery = db.from("furnishing_products").select("id,name,status,scope,workspace_id,updated_at,source_import_id").eq("scope", "workspace").in("status", ["draft", "in_review"]).order("updated_at", { ascending: true }).limit(12);
  let projectQuery = db.from("furnishing_projects").select("id,name,lifecycle_status,workspace_id,updated_at,properties(name)").in("lifecycle_status", activeProjectStates).order("updated_at", { ascending: false }).limit(8);
  if (validWorkspace) { workspaceProductQuery = workspaceProductQuery.eq("workspace_id", validWorkspace); reviewQuery = reviewQuery.eq("workspace_id", validWorkspace); projectQuery = projectQuery.eq("workspace_id", validWorkspace); }
  const [platformProducts, workspaceProducts, reviewProducts, projects, budgets, procurement, installations, activity] = await Promise.all([
    db.from("furnishing_products").select("id", { count: "exact", head: true }).eq("scope", "platform").neq("status", "archived"),
    workspaceProductQuery,
    reviewQuery,
    projectQuery,
    db.from("furnishing_budgets").select("id,status,project_id,furnishing_projects!inner(workspace_id,target_budget_minor,current_plan_version_id)").neq("status", "approved").limit(50),
    db.from("furnishing_procurement_exceptions").select("id,severity,status,created_at,baseline_id").eq("status", "open").limit(50),
    db.from("furnishing_punch_list_items").select("id,status,created_at").neq("status", "resolved").limit(50),
    db.from("furnishing_catalog_activity").select("id,event_type,product_id,import_id,workspace_id,actor_id,occurred_at,profiles:actor_id(full_name,email),furnishing_products(name)").order("occurred_at", { ascending: false }).limit(8),
  ]);
  const sectionError = (result: { error: unknown }) => Boolean(result.error);
  const budgetRows = (budgets.data ?? []).filter((row: Row) => !validWorkspace || String((row.furnishing_projects as Row)?.workspace_id) === validWorkspace);
  return {
    metrics: { platformProducts: platformProducts.count ?? 0, workspaceProducts: workspaceProducts.count ?? 0, productsNeedingReview: reviewProducts.data?.length ?? 0, activeDesignWorkspaces: projects.data?.length ?? 0, budgetsNeedingAttention: budgetRows.length, procurementExceptions: procurement.data?.length ?? 0, installationExceptions: sectionError(installations) ? null : installations.data?.length ?? 0 },
    attention: (reviewProducts.data ?? []).map((product) => ({ id: `catalog-${product.id}`, title: product.status === "in_review" ? "Product awaiting approval" : "Product draft needs review", entity: product.name, category: product.source_import_id ? "Import reconciliation" : "Catalog review", severity: product.status === "in_review" ? "Review" : "Attention", occurredAt: product.updated_at, workspaceId: product.workspace_id, href: `/admin/furnishing/catalog/${product.id}${validWorkspace ? `?workspace=${validWorkspace}` : ""}` })),
    activeWork: projects.data ?? [], activity: activity.data ?? [],
    failures: { catalog: sectionError(reviewProducts), workspaces: sectionError(projects), budgets: sectionError(budgets), procurement: sectionError(procurement), installations: sectionError(installations), activity: sectionError(activity) },
  };
}
