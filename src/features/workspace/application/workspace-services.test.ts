import { describe, expect, it } from "vitest";

import { buildOperationalSurfaceProjection } from "@/features/operational-surfaces";

import {
  getWorkspaceOverview,
  initializeWorkspaceOwner,
  resolveWorkspaceIdentity,
  type WorkspaceRepository,
} from "./workspace-services";
import { WorkspaceAccessError, type WorkspaceIdentity } from "../domain";

const principal = {
  profileId: "profile-1",
  role: "owner" as const,
  displayName: "Luxe Haven",
};
const identity: WorkspaceIdentity = {
  profileId: "profile-1",
  ownerId: "owner-1",
  workspaceId: "owner-1",
};

function projection(status: "never-run" | "succeeded" | "failed" = "never-run") {
  return buildOperationalSurfaceProjection({
    workspaceId: "profile-1",
    workspaceLabel: "Luxe Haven's Workspace",
    contexts: [],
    properties: [],
    sync: {
      status,
      providerLabel: "Hospitable",
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: status === "failed" ? 1 : 0,
      warnings: [],
      affectedCapabilities: status === "failed" ? ["bookings"] : [],
      lastSuccessfulAt: status === "succeeded" ? "2026-07-24T12:00:00Z" : null,
      providerConnected: status !== "never-run",
    },
    now: new Date("2026-07-24T13:00:00Z"),
  });
}

function repository(overrides: Partial<WorkspaceRepository> = {}): WorkspaceRepository {
  return {
    resolveIdentity: async () => identity,
    initializeOwner: async () => identity,
    getOperationalProjection: async () => projection(),
    ...overrides,
  };
}

describe("Workspace application services", () => {
  it("resolves an existing Profile -> Owner -> Workspace identity explicitly", async () => {
    await expect(resolveWorkspaceIdentity(repository(), principal)).resolves.toEqual(identity);
    expect(identity.profileId).not.toBe(identity.ownerId);
    expect(identity.workspaceId).toBe(identity.ownerId);
  });

  it("represents a profile without an owner as intentional first use", async () => {
    const result = await resolveWorkspaceIdentity(
      repository({
        resolveIdentity: async () => ({
          profileId: "profile-1",
          ownerId: null,
          workspaceId: null,
        }),
      }),
      principal,
    );
    expect(result).toEqual({
      profileId: "profile-1",
      ownerId: null,
      workspaceId: null,
    });
  });

  it("returns the same identity for repeated initialization", async () => {
    const initialized: string[] = [];
    const subject = repository({
      initializeOwner: async () => {
        initialized.push("called");
        return identity;
      },
    });
    expect(await initializeWorkspaceOwner(subject, principal)).toEqual(identity);
    expect(await initializeWorkspaceOwner(subject, principal)).toEqual(identity);
    expect(initialized).toHaveLength(2);
  });

  it("rejects cross-profile identity resolution and overview access", async () => {
    const anotherIdentity = { ...identity, profileId: "profile-2" };
    await expect(
      resolveWorkspaceIdentity(
        repository({ resolveIdentity: async () => anotherIdentity }),
        principal,
      ),
    ).rejects.toBeInstanceOf(WorkspaceAccessError);
    await expect(
      getWorkspaceOverview(repository(), principal, anotherIdentity),
    ).rejects.toBeInstanceOf(WorkspaceAccessError);
  });

  it("restricts initialization for roles without workspace administration", async () => {
    await expect(
      initializeWorkspaceOwner(repository(), { ...principal, role: "guest" }),
    ).rejects.toBeInstanceOf(WorkspaceAccessError);
  });

  it("treats empty shared projections as setup work instead of an error", async () => {
    const summary = await getWorkspaceOverview(repository(), principal, identity);
    expect(summary.properties).toEqual({ total: 0, connected: 0 });
    expect(summary.health.state).toBe("setup-required");
    expect(summary.health.setupItems).toContain("Import your first property");
    expect(summary.identity).toEqual(identity);
  });

  it("consumes degraded synchronization from the shared operational projection", async () => {
    const summary = await getWorkspaceOverview(
      repository({ getOperationalProjection: async () => projection("failed") }),
      principal,
      identity,
    );
    expect(summary.health.state).toBe("degraded");
    expect(summary.health.synchronization).toBe("failed");
  });
});
