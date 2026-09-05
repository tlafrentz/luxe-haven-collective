import { describe, expect, it } from "vitest";
import type { AutomationDefinitionRepository } from "./automation-foundation";
import { createAutomationFoundationService } from "./automation-foundation";
import { configuration } from "../domain/automation-definition.test";
import type { AutomationActor } from "../domain/automation-definition";

const actor: AutomationActor = { actorId: "actor-1", tenantId: "tenant-1", role: "administrator", active: true, propertyIds: [] };
class Repository implements AutomationDefinitionRepository {
  value: Awaited<ReturnType<AutomationDefinitionRepository["get"]>> = null;
  activities: string[] = []; notifications: string[] = [];
  async get(tenantId: string, automationId: string) { return this.value?.definition.tenantId === tenantId && this.value.definition.id === automationId ? this.value : null; }
  async list() { return this.value ? [this.value] : []; }
  async create(input: Parameters<AutomationDefinitionRepository["create"]>[0]) { this.value = { definition: input.definition, current: input.version }; this.activities.push(input.activity.eventType); }
  async appendVersion(input: Parameters<AutomationDefinitionRepository["appendVersion"]>[0]) { if (!this.value || this.value.definition.version !== input.expectedVersion) throw new Error("conflict"); this.value = { definition: input.definition, current: input.version }; this.activities.push(input.activity.eventType); if (input.notification) this.notifications.push(input.notification.idempotencyKey); }
}
function service(repository = new Repository()) { let id = 0; return { repository, service: createAutomationFoundationService({ repository, authorization: { async authorize() { return true; } }, clock: () => "2026-08-10T01:00:00.000Z", id: () => `id-${++id}` }) }; }

describe("AU-001A automation foundation application", () => {
  it("creates a draft with activity but no run, trigger occurrence, or dispatch", async () => {
    const { service: application, repository } = service();
    const result = await application.createDraft({ actor, tenantId: "tenant-1", automationId: "automation-1", name: "Draft", description: "Governed definition", configuration, correlationId: "correlation-1" });
    expect(result).toMatchObject({ ok: true, value: { definition: { status: "draft", version: 1 }, current: { version: 1 } } });
    expect(repository.activities).toEqual(["automation-draft-created"]);
    expect(repository.notifications).toEqual([]);
  });

  it("creates immutable revisions with optimistic concurrency", async () => {
    const { service: application } = service();
    await application.createDraft({ actor, tenantId: "tenant-1", automationId: "automation-1", name: "Draft", description: "Governed definition", configuration, correlationId: "correlation-1" });
    const conflict = await application.revise({ actor, tenantId: "tenant-1", automationId: "automation-1", expectedVersion: 0, name: "Changed", description: "Changed", configuration, reason: "Correction", correlationId: "correlation-2" });
    expect(conflict).toMatchObject({ ok: false, code: "AUTOMATION_VERSION_CONFLICT", currentVersion: 1 });
    const changed = await application.revise({ actor, tenantId: "tenant-1", automationId: "automation-1", expectedVersion: 1, name: "Changed", description: "Changed", configuration, reason: "Correction", correlationId: "correlation-3" });
    expect(changed).toMatchObject({ ok: true, value: { definition: { version: 2, currentVersion: 2 }, current: { name: "Changed", version: 2 } } });
  });

  it("records lifecycle activity and notification intent atomically through the repository boundary", async () => {
    const { service: application, repository } = service();
    await application.createDraft({ actor, tenantId: "tenant-1", automationId: "automation-1", name: "Draft", description: "Governed definition", configuration, correlationId: "correlation-1" });
    const submitted = await application.transition({ actor, tenantId: "tenant-1", automationId: "automation-1", expectedVersion: 1, to: "ready-for-review", correlationId: "correlation-2" });
    expect(submitted).toMatchObject({ ok: true, value: { definition: { status: "ready-for-review", version: 2 } } });
    expect(repository.activities).toEqual(["automation-draft-created", "automation-ready-for-review"]);
    expect(repository.notifications[0]).toContain("automation:automation-1:v2:automation-ready-for-review");
  });

  it("denies cross-tenant and inactive actors before persistence, regardless of what the authorization port would allow", async () => {
    for (const denied of [{ ...actor, tenantId: "other" }, { ...actor, active: false }]) {
      const { service: application, repository } = service();
      const result = await application.createDraft({ actor: denied, tenantId: "tenant-1", automationId: "automation-1", name: "Draft", description: "Governed definition", configuration, correlationId: "correlation-1" });
      expect(result).toMatchObject({ ok: false, code: "AUTOMATION_ACCESS_DENIED" });
      expect(repository.value).toBeNull();
    }
  });

  it("denies insufficient role/property scope when the authorization port also denies (PA-006: additive, not automatic)", async () => {
    const repository = new Repository();
    const application = createAutomationFoundationService({ repository, authorization: { async authorize() { return false; } }, clock: () => "2026-08-10T01:00:00.000Z", id: () => "id-1" });
    const denied = { ...actor, role: "operator" as const, propertyIds: ["other"] };
    const result = await application.createDraft({ actor: denied, tenantId: "tenant-1", automationId: "automation-1", name: "Draft", description: "Governed definition", configuration, correlationId: "correlation-1" });
    expect(result).toMatchObject({ ok: false, code: "AUTOMATION_ACCESS_DENIED" });
    expect(repository.value).toBeNull();
  });

  it("allows insufficient role/property scope when the authorization port grants access (PA-006: additive fallback)", async () => {
    const repository = new Repository();
    const application = createAutomationFoundationService({ repository, authorization: { async authorize(input) { return input.legacyAllowed === false; } }, clock: () => "2026-08-10T01:00:00.000Z", id: () => "id-1" });
    const allowed = { ...actor, role: "operator" as const, propertyIds: ["other"] };
    const result = await application.createDraft({ actor: allowed, tenantId: "tenant-1", automationId: "automation-1", name: "Draft", description: "Governed definition", configuration, correlationId: "correlation-1" });
    expect(result).toMatchObject({ ok: true });
    expect(repository.value).not.toBeNull();
  });
});
