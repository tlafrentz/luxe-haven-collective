import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const conversationMigration = readFileSync(
  "supabase/migrations/20260726180000_canonical_conversation_engine.sql",
  "utf8",
);
const hydrationMigration = readFileSync(
  "supabase/migrations/20260727030000_hospitable_historical_message_hydration.sql",
  "utf8",
);
const workspaceMigration = readFileSync(
  "supabase/migrations/20260728120000_finish_guest_communications_workspace_identity.sql",
  "utf8",
);
const webhookRoute = readFileSync(
  "src/app/api/webhooks/hospitable/messages/route.ts",
  "utf8",
);
const actions = readFileSync(
  "src/app/actions/guest-communications.ts",
  "utf8",
);
const conversationPage = readFileSync(
  "src/app/(dashboard)/dashboard/communications/[conversationId]/page.tsx",
  "utf8",
);

describe("GC-005 / GC-006 provider coexistence and manual review", () => {
  it("routes unknown reservations into review before message persistence", () => {
    const queuePosition = webhookRoute.indexOf(
      '.from("messaging_provider_review_queue").upsert',
    );
    const ingestPosition = webhookRoute.indexOf(
      '.rpc("ingest_guest_provider_message"',
    );
    expect(queuePosition).toBeGreaterThan(-1);
    expect(ingestPosition).toBeGreaterThan(queuePosition);
    expect(webhookRoute).toContain('reason:"unknown-reservation"');
    expect(webhookRoute).toContain('status:"pending"');
    expect(webhookRoute).toContain("reviewRequired:true");
  });

  it("resolves review work through thread linking then canonical ingestion", () => {
    const action = actions.slice(
      actions.indexOf("export async function associateProviderReviewMessageAction"),
      actions.indexOf("export async function hydrateHospitableMessageHistoryAction"),
    );
    expect(action.indexOf("await linkProviderThread")).toBeGreaterThan(-1);
    expect(action.indexOf('.rpc("ingest_guest_provider_message"')).toBeGreaterThan(
      action.indexOf("await linkProviderThread"),
    );
    expect(action.indexOf('status:"associated"')).toBeGreaterThan(
      action.indexOf('.rpc("ingest_guest_provider_message"'),
    );
    expect(action).toContain("pending_message_body:null");
  });

  it("uses the same canonical ingestion RPC for webhooks and history", () => {
    expect(webhookRoute).toContain('.rpc("ingest_guest_provider_message"');
    expect(hydrationMigration).toContain(
      "create or replace function public.ingest_guest_provider_message",
    );
    expect(hydrationMigration).toContain(
      "on conflict(provider,provider_native_message_id)",
    );
  });
});

describe("GC-007 UI contract", () => {
  it("renders canonical messages, delivery state, attachments, and relationship history", () => {
    expect(conversationPage).toContain("result.projection.messages.map");
    expect(conversationPage).toContain("message.delivery");
    expect(conversationPage).toContain("message.deliveryHistory");
    expect(conversationPage).toContain("result.projection.attachments.map");
    expect(conversationPage).toContain(
      "View complete relationship history",
    );
  });
});

describe("GC-009 platform invariants", () => {
  it("maps one provider thread to one canonical conversation", () => {
    expect(conversationMigration).toContain(
      "unique(workspace_id,provider,thread_id)",
    );
  });

  it("maps one provider message to one canonical message", () => {
    expect(hydrationMigration).toContain(
      "on conflict(provider,provider_native_message_id)",
    );
    expect(hydrationMigration).toContain(
      "where provider is not null and provider_native_message_id is not null",
    );
  });

  it("maps one reservation to one hydration state", () => {
    expect(hydrationMigration).toContain(
      "unique(workspace_id,provider,provider_reservation_id)",
    );
  });

  it("uses owners.id for every explicit Guest Communications workspace FK", () => {
    for (const table of [
      "guest_relationship_events",
      "guest_communication_templates",
      "guest_communication_recommendations",
      "guest_communication_guidance_activity",
    ]) {
      expect(workspaceMigration).toMatch(
        new RegExp(
          `alter table public\\.${table}[\\s\\S]*?foreign key \\(workspace_id\\)[\\s\\S]*?references public\\.owners\\(id\\)`,
        ),
      );
    }
    expect(workspaceMigration).not.toContain(
      "references public.profiles(id)",
    );
  });
});
