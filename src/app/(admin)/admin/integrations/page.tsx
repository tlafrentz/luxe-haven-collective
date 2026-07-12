import {
  getIntegrationsDashboard,
  IntegrationCard,
  SyncHistory,
} from "@/features/integrations";

export default async function IntegrationsPage() {
  const dashboard =
    await getIntegrationsDashboard();

  return (
    <main className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Admin
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Integrations
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Monitor connected platforms, synchronized
          properties, reservation activity, and sync
          health.
        </p>
      </header>

      {dashboard.integrations.map(
        (integration) => (
          <section
            key={integration.id}
            className="space-y-6"
          >
            <IntegrationCard
              integration={integration}
            />

            <SyncHistory
              history={integration.syncHistory}
            />
          </section>
        ),
      )}
    </main>
  );
}
