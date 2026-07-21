import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: mocks.insert }),
  }),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: mocks.sendEmail,
}));

import { submitLeadMagnet } from "@/app/actions/forms";

function validLead() {
  const formData = new FormData();
  formData.set("name", "Production Test");
  formData.set("email", "production@example.com");
  formData.set("propertyMarket", "Mesa");
  formData.set("propertyStatus", "Self-managing");
  return formData;
}

describe("submitLeadMagnet", () => {
  beforeEach(() => {
    mocks.insert.mockResolvedValue({ error: null });
    mocks.sendEmail.mockResolvedValue({ id: "email-id" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("persists the lead and returns an immediate checklist link", async () => {
    const result = await submitLeadMagnet(
      { ok: false, message: "" },
      validLead(),
    );

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "production@example.com",
        lead_magnet: "str_revenue_readiness_checklist",
      }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      message: "Success — check your inbox for the checklist link.",
      downloadHref: "/resources/str-revenue-readiness-checklist",
    });
  });

  it("keeps a captured lead usable when email delivery fails", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("provider unavailable"));

    const result = await submitLeadMagnet(
      { ok: false, message: "" },
      validLead(),
    );

    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    expect(result.downloadHref).toBe(
      "/resources/str-revenue-readiness-checklist",
    );
    expect(result.message).toContain("request was saved");
  });

  it("does not report success when persistence fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("database unavailable") });

    const result = await submitLeadMagnet(
      { ok: false, message: "" },
      validLead(),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "Something went wrong. Please try again or email us directly.",
    );
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
