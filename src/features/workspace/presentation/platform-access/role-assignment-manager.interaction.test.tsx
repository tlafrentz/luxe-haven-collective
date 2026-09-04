// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleAssignmentManager } from "./role-assignment-manager";
import {
  addRoleAssignmentAction,
  previewRoleAssignmentAccessAction,
  revokeRoleAssignmentAction,
} from "@/app/actions/platform-access-assignments";

vi.mock("@/app/actions/platform-access-assignments", () => ({
  addRoleAssignmentAction: vi.fn(),
  previewRoleAssignmentAccessAction: vi.fn(),
  revokeRoleAssignmentAction: vi.fn(),
}));

const properties = [
  { id: "prop-1", name: "Mesa Vineyard" },
  { id: "prop-2", name: "Coastal Retreat" },
];

function setup(overrides: Partial<Parameters<typeof RoleAssignmentManager>[0]> = {}) {
  vi.mocked(previewRoleAssignmentAccessAction).mockResolvedValue({ today: [], afterGrant: [] });
  const mutate = vi.fn((work: () => Promise<unknown>) => work());
  render(
    <RoleAssignmentManager
      subjectId="member-1"
      workspaceId="workspace-1"
      canManage
      properties={properties}
      assignments={[]}
      mutate={mutate}
      pending={false}
      {...overrides}
    />,
  );
  return { mutate };
}

describe("RoleAssignmentManager interaction", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides the property picker for Entire workspace and shows it for Selected properties", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Module & scope assignments/));
    expect(screen.queryByText("Mesa Vineyard")).toBeNull();
    await user.click(screen.getByLabelText("Selected properties"));
    expect(screen.getByText("Mesa Vineyard")).toBeTruthy();
  });

  it("disables Save until at least one module is selected", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Module & scope assignments/));
    await user.type(screen.getByPlaceholderText("Why is this access needed?"), "Onboarding");
    expect((screen.getByRole("button", { name: "Save assignment" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText("Guidebook Studio"));
    expect((screen.getByRole("button", { name: "Save assignment" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables Save until at least one property is selected in property scope", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Module & scope assignments/));
    await user.type(screen.getByPlaceholderText("Why is this access needed?"), "Onboarding");
    await user.click(screen.getByLabelText("Guidebook Studio"));
    await user.click(screen.getByLabelText("Selected properties"));
    expect((screen.getByRole("button", { name: "Save assignment" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText("Mesa Vineyard"));
    expect((screen.getByRole("button", { name: "Save assignment" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("issues one addRoleAssignmentAction call per selected module x property combination", async () => {
    vi.mocked(addRoleAssignmentAction).mockResolvedValue({ ok: true, message: "Assignment saved." });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Module & scope assignments/));
    await user.type(screen.getByPlaceholderText("Why is this access needed?"), "Onboarding");
    await user.click(screen.getByLabelText("Guidebook Studio"));
    await user.click(screen.getByLabelText("Financial Intelligence"));
    await user.click(screen.getByLabelText("Selected properties"));
    await user.click(screen.getByLabelText("Mesa Vineyard"));
    await user.click(screen.getByLabelText("Coastal Retreat"));
    await user.click(screen.getByRole("button", { name: "Save assignment" }));

    await waitFor(() => expect(addRoleAssignmentAction).toHaveBeenCalledTimes(4));
    expect(addRoleAssignmentAction).toHaveBeenCalledWith(expect.objectContaining({ module: "guidebooks", scopeId: "prop-1" }));
    expect(addRoleAssignmentAction).toHaveBeenCalledWith(expect.objectContaining({ module: "guidebooks", scopeId: "prop-2" }));
    expect(addRoleAssignmentAction).toHaveBeenCalledWith(expect.objectContaining({ module: "financials", scopeId: "prop-1" }));
    expect(addRoleAssignmentAction).toHaveBeenCalledWith(expect.objectContaining({ module: "financials", scopeId: "prop-2" }));
  });

  it("saves once per selected module with a null scope id for Entire workspace", async () => {
    vi.mocked(addRoleAssignmentAction).mockResolvedValue({ ok: true, message: "Assignment saved." });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Module & scope assignments/));
    await user.type(screen.getByPlaceholderText("Why is this access needed?"), "Onboarding");
    await user.click(screen.getByLabelText("Guidebook Studio"));
    await user.click(screen.getByRole("button", { name: "Save assignment" }));
    await waitFor(() => expect(addRoleAssignmentAction).toHaveBeenCalledTimes(1));
    expect(addRoleAssignmentAction).toHaveBeenCalledWith(expect.objectContaining({ module: "guidebooks", scopeType: "workspace", scopeId: null }));
  });

  it("requests a preview covering every selected module", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Module & scope assignments/));
    await user.click(screen.getByLabelText("Guidebook Studio"));
    await user.click(screen.getByLabelText("Financial Intelligence"));
    await waitFor(() => expect(previewRoleAssignmentAccessAction).toHaveBeenLastCalledWith(expect.objectContaining({ modules: ["guidebooks", "financials"] })));
  });

  it("confirms before revoking an existing assignment", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(revokeRoleAssignmentAction).mockResolvedValue({ ok: true, message: "Assignment revoked." });
    const user = userEvent.setup();
    setup({
      assignments: [
        { id: "ra-1", subjectId: "member-1", roleId: "role-1", roleName: "manager", roleLabel: "Manager", module: "guidebooks", scopeType: "workspace", scopeId: null, reason: "onboarding", version: 1 },
      ],
    });
    const list = screen.getByRole("list");
    await user.click(within(list).getByRole("button", { name: "Revoke" }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(revokeRoleAssignmentAction).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: "ra-1", expectedVersion: 1 })));
  });

  it("does not revoke when the confirmation is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    setup({
      assignments: [
        { id: "ra-1", subjectId: "member-1", roleId: "role-1", roleName: "manager", roleLabel: "Manager", module: "guidebooks", scopeType: "workspace", scopeId: null, reason: "onboarding", version: 1 },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(revokeRoleAssignmentAction).not.toHaveBeenCalled();
  });

  it("renders no Add/Revoke controls when the viewer cannot manage assignments", async () => {
    const user = userEvent.setup();
    setup({
      canManage: false,
      assignments: [
        { id: "ra-1", subjectId: "member-1", roleId: "role-1", roleName: "manager", roleLabel: "Manager", module: "guidebooks", scopeType: "workspace", scopeId: null, reason: "onboarding", version: 1 },
      ],
    });
    await user.click(screen.getByText(/Module & scope assignments/));
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save assignment" })).toBeNull();
  });
});
