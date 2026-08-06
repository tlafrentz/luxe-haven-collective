import Link from "next/link";
import { AlertTriangle, Building2, CheckCircle2, PlugZap, RefreshCw } from "lucide-react";

import { workspaceHospitableSyncAction, workspacePropertySystemAction } from "@/app/actions/workspace-properties-systems";
import {
  WorkspaceCard, WorkspaceContent, WorkspaceGrid, WorkspaceHeader, WorkspacePage,
} from "@/components/application-layout";
import type { PropertiesAndSystemsOverview } from "../application/properties-systems-services";

const badge = (status: string) => (
  <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold capitalize text-stone-700">
    {status.replaceAll("-", " ")}
  </span>
);

export function WorkspacePropertiesPage({ overview, canManage, title = "Properties", description = "Configure which canonical hospitality assets belong to this workspace. Day-to-day guest operations remain in Operational Properties." }: Readonly<{
  overview: PropertiesAndSystemsOverview; canManage: boolean; title?: string; description?: string;
}>) {
  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader eyebrow="Workspace configuration" title={title}
        description={description} />
      <WorkspaceContent>
        <WorkspaceGrid>
          <Summary label="Configured" value={overview.health.propertiesConfigured} />
          <Summary label="Provider linked" value={overview.health.propertiesLinked} />
          <Summary label="Systems healthy" value={overview.health.connectedSystemsHealthy} />
        </WorkspaceGrid>
      </WorkspaceContent>
      <WorkspaceContent>
        {!overview.properties.length ? (
          <WorkspaceCard level={2} className="p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-amber-700" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">No properties are configured</h2>
            <p className="mt-2 text-sm text-stone-600">Connect a hospitality platform to import your first canonical property.</p>
            <Link href="/dashboard/workspace/connected-systems" className="mt-5 inline-flex rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">Connect system</Link>
          </WorkspaceCard>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr>
                <th className="px-5 py-3">Property</th><th className="px-5 py-3">Status</th>
                <th className="hidden px-5 py-3 md:table-cell">Provider</th><th className="hidden px-5 py-3 lg:table-cell">Data health</th>
                <th className="px-5 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-stone-100">
                {overview.properties.map((property) => (
                  <tr key={property.propertyId}>
                    <td className="px-5 py-4"><strong className="block text-stone-950">{property.name}</strong><span className="text-stone-500">{property.location ?? "Location not configured"}</span></td>
                    <td className="px-5 py-4">{badge(property.status)}</td>
                    <td className="hidden px-5 py-4 md:table-cell">{property.providerLinks[0]?.provider ?? "Unlinked"}</td>
                    <td className="hidden px-5 py-4 capitalize lg:table-cell">{property.dataQuality.status.replaceAll("-", " ")}</td>
                    <td className="px-5 py-4">
                      {canManage && property.inclusion !== "archived" ? (
                        <form action={workspacePropertySystemAction}>
                          <input type="hidden" name="workspaceId" value={property.workspaceId} />
                          <input type="hidden" name="targetId" value={property.propertyId} />
                          <input type="hidden" name="action" value={property.inclusion === "included" ? "exclude-property" : "include-property"} />
                          <button className="font-semibold text-amber-800" type="submit">{property.inclusion === "included" ? "Exclude" : "Include"}</button>
                        </form>
                      ) : <span className="text-stone-500">Read only</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspaceContent>
    </WorkspacePage>
  );
}

export function WorkspaceConnectedSystemsPage({ overview, canManage }: Readonly<{
  overview: PropertiesAndSystemsOverview; canManage: boolean;
}>) {
  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader eyebrow="Workspace configuration" title="Connected Systems"
        description="Review external platform connectivity, property linkage, synchronization freshness, and recovery actions without exposing provider secrets." />
      <WorkspaceContent>
        {!overview.systems.length ? (
          <WorkspaceCard level={2} className="p-8">
            <PlugZap className="h-8 w-8 text-amber-700" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">No connected systems</h2>
            <p className="mt-2 text-sm text-stone-600">Connect Hospitable through the approved secure connection flow to import properties and reservations.</p>
          </WorkspaceCard>
        ) : overview.systems.map((system) => (
          <WorkspaceCard key={system.connectionId} level={2} className="mb-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Provider</p>
                <h2 className="mt-1 text-xl font-semibold">{system.providerLabel}</h2>
                <p className="mt-2 text-sm text-stone-600">{system.connectionSummary}</p>
              </div>
              {badge(system.status)}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <p className="text-sm"><strong className="block">{system.management === "platform" ? "Data access" : "Last successful sync"}</strong>{system.management === "platform" ? "On demand" : system.lastSuccessfulSyncAt ? new Date(system.lastSuccessfulSyncAt).toLocaleString() : "Never"}</p>
              <p className="text-sm"><strong className="block">Capabilities</strong>{system.capabilities.map(({ name }) => name).join(", ")}</p>
              <p className="text-sm"><strong className="block">Current issues</strong>{system.issues.length || "None"}</p>
            </div>
            {canManage && system.management === "workspace" ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {system.provider === "hospitable" && system.status !== "disconnected" ? (
                  <form action={workspaceHospitableSyncAction}>
                    <input type="hidden" name="workspaceId" value={system.workspaceId} />
                    <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                      <RefreshCw className="h-4 w-4" aria-hidden />Sync now
                    </button>
                  </form>
                ) : null}
                <form action={workspacePropertySystemAction}>
                  <input type="hidden" name="workspaceId" value={system.workspaceId} />
                  <input type="hidden" name="targetId" value={system.connectionId} />
                  <input type="hidden" name="action" value={system.status === "disconnected" ? "reconnect" : "disconnect"} />
                  <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold">
                    <RefreshCw className="h-4 w-4" aria-hidden />{system.status === "disconnected" ? "Reconnect" : "Disconnect"}
                  </button>
                </form>
              </div>
            ) : system.management === "platform" ? (
              <p className="mt-5 text-sm text-stone-600">{typeof system.apiCallCount === "number" ? `${system.apiCallCount.toLocaleString()} API ${system.apiCallCount === 1 ? "call" : "calls"} made to date.` : "API call volume is not yet available."}</p>
            ) : <p className="mt-5 text-sm text-stone-600">Connection management is limited to workspace owners and administrators.</p>}
          </WorkspaceCard>
        ))}
      </WorkspaceContent>
      {overview.health.state !== "healthy" ? (
        <WorkspaceContent><WorkspaceCard level={3} className="border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden /><p className="mt-2 font-semibold text-amber-950">Properties or synchronization need attention.</p>
          <p className="mt-1 text-sm text-amber-900">Last known operational data remains available while the source is restored.</p>
        </WorkspaceCard></WorkspaceContent>
      ) : <span className="sr-only"><CheckCircle2 />Connected systems are healthy.</span>}
    </WorkspacePage>
  );
}

function Summary({ label, value }: Readonly<{ label: string; value: number }>) {
  return <WorkspaceCard level={2} className="col-span-2 p-5 md:col-span-4"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></WorkspaceCard>;
}
