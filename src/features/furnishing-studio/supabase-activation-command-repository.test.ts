import { describe, expect, it, vi } from "vitest";
import { createSupabaseFurnishingActivationRepository } from "./supabase-activation-command-repository";
describe("FS-008A P2.4B3 repository composition", () => {
  it("uses the transactional authenticated RPC for state and audit", async () => { const rpc = vi.fn().mockResolvedValue({ error: null }); const client = { rpc }; const repo = createSupabaseFurnishingActivationRepository(client as never); await repo.commit({ before: { target: "global", targetId: "g", state: "disabled", version: 1 }, after: { target: "global", targetId: "g", state: "internal", version: 2 }, audit: {} as never, fingerprint: "f" }); expect(rpc).toHaveBeenCalledWith("apply_furnishing_activation_control", expect.any(Object)); });
  it("fails closed when the repository RPC is unavailable", async () => { const repo = createSupabaseFurnishingActivationRepository({ rpc: vi.fn().mockResolvedValue({ error: new Error("down") }) } as never); await expect(repo.commit({ before: {} as never, after: {} as never, audit: {} as never, fingerprint: "f" })).rejects.toThrow("ACTIVATION_REPOSITORY_UNAVAILABLE"); });
});
