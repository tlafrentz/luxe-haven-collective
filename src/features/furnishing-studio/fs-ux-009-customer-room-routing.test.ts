import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  "src/app/(dashboard)/dashboard/furnishing/projects/[projectId]/page.tsx",
  "utf8",
);
const workspace = readFileSync(
  "src/components/furnishing/simplified-project-workspace.tsx",
  "utf8",
);

describe("FS-UX-009 customer room routing", () => {
  it("awaits the customer route query and passes the selected room through the simplified shell", () => {
    expect(page).toContain("searchParams: Promise<{ room?: string }>");
    expect(page).toContain("const [{ projectId }, query] = await Promise.all");
    expect(page).toContain("roomId={query.room}");
    expect(workspace).toContain("roomId?: string");
    expect(workspace).toContain(
      "<ProjectWorkspace projectId={id} customer={customer} roomId={roomId} />",
    );
  });
});
