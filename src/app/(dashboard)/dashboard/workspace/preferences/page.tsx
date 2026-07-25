import { WorkspaceCard, WorkspaceContent, WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
import {
  getEffectiveWorkspaceSettings, resolveWorkspaceAccessContext, SupabaseNotificationsPreferencesRepository,
  SupabaseTeamAccessRepository, WorkspacePreferencesForm,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function PreferencesPage() {
  const { user } = await requireUser();
  const context = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  const settings = await getEffectiveWorkspaceSettings(new SupabaseNotificationsPreferencesRepository(), context);
  return <WorkspacePage width="medium"><WorkspaceHeader eyebrow="Personal settings" title="Preferences" description="Control how Luxe Haven behaves for you without changing Organization defaults, property configuration, or canonical stored timestamps." />
    <WorkspaceContent><WorkspaceCard level={2} className="p-5"><h2 className="font-semibold">Effective settings</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-stone-500">Timezone</dt><dd className="font-semibold">{settings.preferences.timezone ?? settings.notifications.timezone}</dd><dd className="text-xs capitalize text-stone-500">{settings.timezoneSource}</dd></div><div><dt className="text-stone-500">Locale</dt><dd className="font-semibold">{settings.preferences.locale}</dd></div><div><dt className="text-stone-500">Property context</dt><dd className="font-semibold capitalize">{settings.preferences.defaultPropertyMode.replaceAll("-", " ")}</dd></div></dl></WorkspaceCard></WorkspaceContent>
    <WorkspaceContent><WorkspacePreferencesForm settings={settings} /></WorkspaceContent>
  </WorkspacePage>;
}
