import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleOptionCard, RoleOptionGrid, RoleSummaryCard, type RoleOption } from "./role-option-card";

const manager: RoleOption = { id: "manager", label: "Manager", description: "Approve and execute in assigned modules and scope.", bullets: ["Create and edit", "Approve internal workflow"] };
const viewer: RoleOption = { id: "viewer", label: "Viewer", description: "Read-only access to permitted information." };

describe("RoleOptionCard", () => {
  it("exposes role=radio and toggles aria-checked based on selection", () => {
    const selected = renderToStaticMarkup(<RoleOptionCard option={manager} selected onSelect={() => {}} />);
    const unselected = renderToStaticMarkup(<RoleOptionCard option={manager} selected={false} onSelect={() => {}} />);
    expect(selected).toContain('role="radio"');
    expect(selected).toContain('aria-checked="true"');
    expect(unselected).toContain('aria-checked="false"');
  });
});

describe("RoleOptionGrid", () => {
  it("wraps every option in a radiogroup", () => {
    const html = renderToStaticMarkup(<RoleOptionGrid legend="Choose a role" options={[manager, viewer]} selectedId="manager" onSelect={() => {}} />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Manager");
    expect(html).toContain("Viewer");
  });
});

describe("RoleSummaryCard", () => {
  it("renders as a non-interactive article with no radio semantics", () => {
    const html = renderToStaticMarkup(<RoleSummaryCard option={manager} />);
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain("<button");
    expect(html).toContain("<article");
    expect(html).toContain("Approve internal workflow");
  });
});
