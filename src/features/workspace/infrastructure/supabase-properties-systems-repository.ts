import { createClient } from "@/lib/supabase/server";
import { getOperationalSurfaceProjection } from "@/features/operational-surfaces";
import { DEFAULT_INTEGRATION_PROVIDERS, describeProviderCapability } from "@/features/integrations";
import { getMarketIntelligenceConfig } from "@/features/market-intelligence/infrastructure/market-intelligence-config";
import { getProviderApiCallCounts } from "@/platform/provider-usage";

import type {
  PropertiesSystemsRepository,
  PropertySystemActivity,
} from "../application/properties-systems-services";
import {
  evaluatePropertyOperationalReadiness,
  mapConnectedSystemStatus,
  type ConnectedSystemSummary,
  type ProviderLinkageState,
  type WorkspacePropertySummary,
} from "../domain/properties-systems";
import type { WorkspaceAccessContext } from "../domain/team-access";

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value : undefined;

export class SupabasePropertiesSystemsRepository implements PropertiesSystemsRepository {
  async overview(context: WorkspaceAccessContext) {
    const supabase = await createClient();
    const [propertyResult, configurationResult, referenceResult, connectionResult, activityResult, operations] = await Promise.all([
      supabase.from("properties").select("id,owner_id,name,city,state,status,timezone,updated_at").eq("owner_id", context.workspaceId).order("name"),
      supabase.from("property_workspace_configuration").select("property_id,inclusion,timezone_override").eq("workspace_id", context.workspaceId),
      supabase.from("external_properties").select("id,connection_id,property_id,provider,external_id,external_name,link_status,last_observed_at").eq("workspace_id", context.workspaceId),
      supabase.from("integration_connections").select("id,provider,status,account_label,connected_at,last_successful_sync_at,last_attempt_at").eq("workspace_id", context.workspaceId),
      supabase.from("workspace_property_system_activity").select("id,action,result,occurred_at").eq("workspace_id", context.workspaceId).order("occurred_at", { ascending: false }).limit(12),
      getOperationalSurfaceProjection({
        principal: {
          userId: context.profileId,
          workspaceId: context.profileId,
          role: context.role === "administrator" ? "admin" : context.role === "owner" ? "owner" : "cleaner",
        },
        workspaceLabel: "Hospitality Workspace",
      }),
    ]);
    for (const result of [propertyResult, configurationResult, referenceResult, connectionResult, activityResult]) {
      if (result.error) throw new Error(`Workspace properties and systems could not be loaded: ${result.error.message}`);
    }
    const configurations = new Map((configurationResult.data as Row[]).map((row) => [row.property_id, row]));
    const references = referenceResult.data as Row[];
    const connections = connectionResult.data as Row[];
    const visible = context.propertyAccess.type === "selected" ? new Set(context.propertyAccess.propertyIds) : null;
    const properties = (propertyResult.data as Row[])
      .filter((row) => context.propertyAccess.type !== "none" && (!visible || visible.has(String(row.id))))
      .map((row): WorkspacePropertySummary => {
        const configuration = configurations.get(row.id) ?? {};
        const links = references.filter((reference) => reference.property_id === row.id).map((reference) => ({
          referenceId: String(reference.id),
          connectionId: String(reference.connection_id),
          provider: text(reference.provider) ?? "unknown",
          externalPropertyId: text(reference.external_id) ?? "",
          externalPropertyName: text(reference.external_name),
          state: (text(reference.link_status) ?? "unknown") as ProviderLinkageState,
          lastObservedAt: text(reference.last_observed_at),
        }));
        const inclusion = (text(configuration.inclusion) ?? "included") as WorkspacePropertySummary["inclusion"];
        const timezone = text(configuration.timezone_override) ?? text(row.timezone);
        const linkage = links[0]?.state ?? "unlinked";
        const operational = operations.properties.find(({ property }) => property.id === row.id);
        return Object.freeze({
          propertyId: String(row.id), workspaceId: context.workspaceId, ownerId: String(row.owner_id),
          name: text(row.name) ?? "Unnamed property",
          location: [text(row.city), text(row.state)].filter(Boolean).join(", ") || undefined,
          timezone,
          timezoneSource: text(configuration.timezone_override) ? "property-override" : timezone ? "organization-default" : "missing",
          status: evaluatePropertyOperationalReadiness({
            canonicalStatus: text(row.status) ?? "active", inclusion, linkage,
            syncStatus: operations.synchronization.status, qualityStatus: operational?.quality.status ?? "unknown", timezone,
          }),
          inclusion, providerLinks: links,
          synchronization: {
            status: operations.synchronization.status,
            lastSuccessfulAt: operational?.property.lastSynchronizedAt ?? undefined,
            stale: ["failed", "partially-succeeded"].includes(operations.synchronization.status),
          },
          dataQuality: {
            status: operational?.quality.status ?? "unknown",
            issueCount: operational
              ? Object.values(operational.quality.openIssues).reduce((total, count) => total + count, 0)
              : 0,
          },
          accessSummary: { allPropertyMembers: 0, assignedMembers: 0 },
          updatedAt: text(row.updated_at) ?? new Date(0).toISOString(),
        });
      });
    const systems = connections.map((connection): ConnectedSystemSummary => {
      const providerId = text(connection.provider) ?? "unknown";
      const descriptor = DEFAULT_INTEGRATION_PROVIDERS.get(providerId);
      const discovered = references.filter((reference) => reference.connection_id === connection.id);
      const linked = discovered.filter((reference) => reference.link_status === "linked").length;
      const status = mapConnectedSystemStatus({
        connectionStatus: text(connection.status), linked, discovered: discovered.length,
      });
      return Object.freeze({
        connectionId: String(connection.id), workspaceId: context.workspaceId,
        provider: providerId, providerLabel: descriptor?.displayName ?? providerId, management: "workspace",
        connectionSummary: `${linked} of ${discovered.length} properties linked`, status,
        accountLabel: text(connection.account_label), connectedAt: text(connection.connected_at),
        lastSuccessfulSyncAt: text(connection.last_successful_sync_at), lastAttemptAt: text(connection.last_attempt_at),
        propertyCount: discovered.length, linkedPropertyCount: linked,
        attentionPropertyCount: discovered.length - linked,
        synchronization: {
          status: operations.synchronization.status,
          processed: operations.synchronization.succeeded.created + operations.synchronization.succeeded.updated + operations.synchronization.succeeded.unchanged + operations.synchronization.failed.records,
          updated: operations.synchronization.succeeded.updated,
          failed: operations.synchronization.failed.records,
        },
        capabilities: [
          { name: "Properties", status: "available" as const },
          { name: "Bookings", status: status === "connected" ? "available" as const : "partially-available" as const },
          { name: "Guest context", status: status === "connected" ? "available" as const : "partially-available" as const },
        ],
        issues: status === "connected" ? [] : [`Connection is ${status.replaceAll("-", " ")}.`],
      });
    });
    const apiCallCounts = await getProviderApiCallCounts(supabase);
    try {
      const marketConfig = getMarketIntelligenceConfig();
      if (marketConfig.providerEnabled) {
        const provider = DEFAULT_INTEGRATION_PROVIDERS.require("rentcast");
        systems.push(Object.freeze({
          connectionId: "platform:rentcast",
          workspaceId: context.workspaceId,
          provider: provider.id,
          providerLabel: provider.displayName,
          management: "platform",
          connectionSummary: "Market intelligence provider · Available workspace-wide",
          status: "connected",
          propertyCount: 0,
          linkedPropertyCount: 0,
          attentionPropertyCount: 0,
          synchronization: {
            status: "never-run" as const,
            processed: 0,
            updated: 0,
            failed: 0,
          },
          capabilities: provider.capabilities.map((capability) => ({
            name: describeProviderCapability(capability),
            status: "available" as const,
          })),
          apiCallCount: apiCallCounts[provider.id],
          issues: [],
        }));
      }
    } catch {
      if (process.env.MARKET_PROVIDER_ENABLED !== "false") {
        const provider = DEFAULT_INTEGRATION_PROVIDERS.require("rentcast");
        systems.push(Object.freeze({
          connectionId: "platform:rentcast",
          workspaceId: context.workspaceId,
          provider: provider.id,
          providerLabel: provider.displayName,
          management: "platform",
          connectionSummary: "Market intelligence provider · Configuration needs attention",
          status: "degraded",
          propertyCount: 0,
          linkedPropertyCount: 0,
          attentionPropertyCount: 0,
          synchronization: { status: "never-run" as const, processed: 0, updated: 0, failed: 0 },
          capabilities: provider.capabilities.map((capability) => ({
            name: describeProviderCapability(capability),
            status: "unavailable" as const,
          })),
          apiCallCount: apiCallCounts[provider.id],
          issues: ["Provider configuration is incomplete."],
        }));
      }
    }
    const platformProviders = [
      {
        id: "realtyapi",
        enabled: process.env.MARKET_PROVIDER_ENABLED !== "false",
        configured: Boolean(process.env.REALTY_API_KEY?.trim()),
        summary: "Property intelligence provider",
      },
      {
        id: "airroi",
        enabled: process.env.MARKET_INTELLIGENCE_ENABLED !== "false",
        configured: Boolean(process.env.AIRROI_API_KEY?.trim()),
        summary: "STR market intelligence provider",
      },
    ] as const;
    for (const item of platformProviders) {
      if (!item.enabled || systems.some(({ provider }) => provider === item.id)) continue;
      const provider = DEFAULT_INTEGRATION_PROVIDERS.require(item.id);
      const configured = item.configured;
      systems.push(Object.freeze({
        connectionId: `platform:${provider.id}`,
        workspaceId: context.workspaceId,
        provider: provider.id,
        providerLabel: provider.displayName,
        management: "platform",
        connectionSummary: `${item.summary} · ${configured ? "Available workspace-wide" : "Configuration needs attention"}`,
        status: configured ? "connected" : "degraded",
        propertyCount: 0,
        linkedPropertyCount: 0,
        attentionPropertyCount: 0,
        synchronization: { status: "never-run" as const, processed: 0, updated: 0, failed: 0 },
        capabilities: provider.capabilities.map((capability) => ({
          name: describeProviderCapability(capability),
          status: configured ? "available" as const : "unavailable" as const,
        })),
        apiCallCount: apiCallCounts[provider.id],
        issues: configured ? [] : ["Provider configuration is incomplete."],
      }));
    }
    return {
      properties,
      systems,
      activity: (activityResult.data as Row[]).map((row): PropertySystemActivity => ({
        id: String(row.id), action: text(row.action) ?? "updated",
        result: text(row.result) ?? "succeeded", occurredAt: text(row.occurred_at) ?? "",
      })),
    };
  }

  async command(input: Parameters<PropertiesSystemsRepository["command"]>[0]) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("apply_workspace_property_system_command", {
      p_workspace_id: input.context.workspaceId,
      p_action: input.action,
      p_target_id: input.targetId,
      p_payload: input.payload ?? {},
      p_command_id: input.commandId,
    });
    if (error) throw new Error(`Workspace configuration could not be updated: ${error.message}`);
  }
}
