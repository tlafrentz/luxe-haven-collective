"use client";

import { useState, useTransition } from "react";

import {
  addRoleAssignmentAction,
  previewRoleAssignmentAccessAction,
  revokeRoleAssignmentAction,
  type AssignmentActionResult,
  type AssignmentPreview,
  type RoleAssignmentRow,
} from "@/app/actions/platform-access-assignments";
import type { RoleName } from "@/features/platform-access";
import { RoleOptionGrid, type RoleOption } from "./role-option-card";

// Workspace Owner and Administrator are workspace-wide by construction (no
// module, scope is always the whole workspace) -- this form is specifically
// for the new module+scope capability, so only the three module-scoped
// roles are offered here. Owner/Administrator-level access is still managed
// through the existing workspace role control above.
const ASSIGNABLE_ROLES: readonly RoleOption[] = [
  { id: "manager", label: "Manager", description: "Create, edit, assign, approve, publish, and execute within this module and scope." },
  { id: "contributor", label: "Contributor", description: "Create, edit, comment, and complete work; cannot approve or publish externally." },
  { id: "viewer", label: "Viewer", description: "Read-only access within this module and scope." },
];

const MODULES = [
  { id: "guidebooks", label: "Guidebook Studio" },
  { id: "investments", label: "Investment Analysis" },
  { id: "actions", label: "Action Center" },
  { id: "financials", label: "Financial Intelligence" },
  { id: "revenue", label: "Revenue" },
  { id: "operations", label: "Operations" },
  { id: "automations", label: "Automations" },
  { id: "furnishing", label: "Furnishing Studio" },
] as const;

type PropertyOption = Readonly<{ id: string; name: string }>;
type ScopeChoice = "workspace" | "property";

function moduleLabel(module: string | null) {
  return MODULES.find((entry) => entry.id === module)?.label ?? module ?? "Workspace-wide";
}
function scopeSummary(assignment: RoleAssignmentRow, properties: readonly PropertyOption[]) {
  if (assignment.scopeType === "workspace") return "Entire workspace";
  return properties.find((property) => property.id === assignment.scopeId)?.name ?? `Property ${assignment.scopeId}`;
}

export function RoleAssignmentManager({
  subjectId,
  workspaceId,
  canManage,
  properties,
  assignments,
  mutate,
  pending,
}: Readonly<{
  subjectId: string;
  workspaceId: string;
  canManage: boolean;
  properties: readonly PropertyOption[];
  assignments: readonly RoleAssignmentRow[];
  mutate: (work: () => Promise<AssignmentActionResult>) => void;
  pending: boolean;
}>) {
  const [role, setRole] = useState<RoleName>("manager");
  const [module, setModule] = useState<string>(MODULES[0].id);
  const [scope, setScope] = useState<ScopeChoice>("workspace");
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [previewPending, startPreview] = useTransition();

  const refreshPreview = (nextRole: RoleName = role, nextModule = module, nextScope: ScopeChoice = scope, nextProperties = selectedProperties) => {
    startPreview(async () => {
      setPreview(
        await previewRoleAssignmentAccessAction({
          subjectId,
          workspaceId,
          role: nextRole,
          module: nextModule,
          scopeType: nextScope === "workspace" ? "workspace" : "property",
          scopeId: nextScope === "property" ? (nextProperties[0] ?? null) : null,
        }),
      );
    });
  };

  const save = () => {
    const scopeIds = scope === "workspace" ? [null] : selectedProperties;
    mutate(async () => {
      for (const scopeId of scopeIds) {
        const result = await addRoleAssignmentAction({ subjectId, role, workspaceId, module, scopeType: scope === "workspace" ? "workspace" : "property", scopeId, reason });
        if (!result.ok) return result;
      }
      setReason("");
      setSelectedProperties([]);
      setPreview(null);
      return { ok: true, message: "Assignment saved." };
    });
  };

  return (
    <details
      className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4"
      onToggle={(event) => {
        if (event.currentTarget.open && canManage && !preview) refreshPreview();
      }}
    >
      <summary className="cursor-pointer text-xs font-semibold text-stone-700">Module &amp; scope assignments ({assignments.length})</summary>
      <div className="mt-4 space-y-4">
        {assignments.length ? (
          <ul className="space-y-2">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
                <span>
                  <strong>{assignment.roleLabel}</strong> · {moduleLabel(assignment.module)} · {scopeSummary(assignment, properties)}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm("Revoke this assignment?")) {
                        mutate(() => revokeRoleAssignmentAction({ assignmentId: assignment.id, expectedVersion: assignment.version, reason: "Revoked from Team & Access" }));
                      }
                    }}
                    className="font-semibold text-red-700 disabled:opacity-40"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-stone-500">No module or scope assignments yet.</p>
        )}
        {canManage ? (
          <div className="space-y-4 border-t border-stone-200 pt-4">
            <RoleOptionGrid
              legend="Role"
              options={ASSIGNABLE_ROLES}
              selectedId={role}
              columns="sm:grid-cols-3"
              onSelect={(id) => {
                const next = id as RoleName;
                setRole(next);
                refreshPreview(next);
              }}
            />
            <label className="block text-xs font-semibold text-stone-700">
              Module
              <select
                value={module}
                onChange={(event) => {
                  setModule(event.target.value);
                  refreshPreview(role, event.target.value);
                }}
                className="organization-input mt-1"
              >
                {MODULES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="text-xs font-semibold text-stone-700">Scope</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {(["workspace", "property"] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2 rounded-full border border-stone-200 px-3 py-2 text-xs">
                    <input
                      type="radio"
                      name={`scope-${subjectId}`}
                      checked={scope === value}
                      onChange={() => {
                        setScope(value);
                        refreshPreview(role, module, value);
                      }}
                    />
                    {value === "workspace" ? "Entire workspace" : "Selected properties"}
                  </label>
                ))}
              </div>
            </fieldset>
            {scope === "property" ? (
              <fieldset>
                <legend className="text-xs font-semibold text-stone-700">Choose at least one property</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {properties.map((property) => (
                    <label key={property.id} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedProperties.includes(property.id)}
                        onChange={(event) => {
                          const next = event.target.checked ? [...selectedProperties, property.id] : selectedProperties.filter((id) => id !== property.id);
                          setSelectedProperties(next);
                          refreshPreview(role, module, scope, next);
                        }}
                      />
                      {property.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="block text-xs font-semibold text-stone-700">
              Reason
              <input required value={reason} onChange={(event) => setReason(event.target.value)} className="organization-input mt-1" placeholder="Why is this access needed?" />
            </label>
            <AssignmentPreviewView preview={preview} pending={previewPending} roleLabel={ASSIGNABLE_ROLES.find((entry) => entry.id === role)?.label ?? role} />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={pending || !reason.trim() || (scope === "property" && !selectedProperties.length)}
                onClick={save}
                className="min-h-11 rounded-full bg-stone-950 px-5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Save assignment
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function AssignmentPreviewView({ preview, pending, roleLabel }: Readonly<{ preview: AssignmentPreview | null; pending: boolean; roleLabel: string }>) {
  if (pending) return <p className="text-xs text-stone-500">Checking access…</p>;
  if (!preview) return null;
  return (
    <div role="status" aria-live="polite" className="rounded-lg bg-white p-3 text-xs">
      <p className="font-semibold text-stone-800">Today:</p>
      <ul className="mt-1 space-y-0.5 text-stone-600">
        {preview.today.map((item) => (
          <li key={item.privilegeId}>
            {item.allowed ? "✓" : "✗"} {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 font-semibold text-stone-800">After this grant, {roleLabel} will additionally be able to:</p>
      {preview.afterGrant.map((group) => (
        <p key={group.module} className="mt-1 text-stone-600">
          {group.actions.join(", ")}
        </p>
      ))}
    </div>
  );
}
