import Link from "next/link";
import { Bell, ShieldCheck } from "lucide-react";
import { updateNotificationStateAction } from "@/app/actions/workspace-notifications-preferences";
import { WorkspaceCard, WorkspaceContent, WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
import {
  getEffectiveWorkspaceSettings, NotificationPreferencesForm, resolveWorkspaceAccessContext,
  SupabaseNotificationsPreferencesRepository, SupabaseTeamAccessRepository,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function NotificationsPage() {
  const { user } = await requireUser();
  const context = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  const settings = await getEffectiveWorkspaceSettings(new SupabaseNotificationsPreferencesRepository(), context);
  return <WorkspacePage width="medium">
    <WorkspaceHeader eyebrow="Personal settings" title="Notifications" description="Choose which authorized events reach you, through which channels, and when. Required access and security alerts remain protected." context={<span className="rounded-full border px-3 py-2 text-xs font-semibold">{settings.unreadCount} unread</span>} />
    {!settings.notifications.confirmed ? <WorkspaceContent><WorkspaceCard level={3} className="bg-amber-50 p-6"><Bell className="h-6 w-6 text-amber-700" aria-hidden /><h2 className="mt-3 text-lg font-semibold">Choose what deserves your attention</h2><p className="mt-2 text-sm">Role-aware defaults are active. Review them to confirm your timezone, delivery channels, and digest.</p></WorkspaceCard></WorkspaceContent> : null}
    <WorkspaceContent><NotificationPreferencesForm settings={settings} /></WorkspaceContent>
    <WorkspaceContent><h2 className="text-xl font-semibold">Notification center</h2>
      {!settings.notificationsList.length ? <p className="mt-3 rounded-xl bg-stone-50 p-5 text-sm text-stone-600">No notifications yet.</p> :
      <ul className="mt-4 divide-y rounded-2xl border bg-white">{settings.notificationsList.map((item) => <li key={item.id} className={`p-5 ${item.status === "unread" ? "bg-amber-50/40" : ""}`}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide">{item.urgency.replaceAll("-", " ")}</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-stone-600">{item.body}</p>{item.actionUrl ? <Link className="mt-2 inline-block text-sm font-semibold text-amber-800" href={item.actionUrl}>Open related context</Link> : null}</div>{item.required ? <span className="inline-flex items-center gap-1 text-xs font-semibold"><ShieldCheck className="h-4 w-4" />Required</span> : null}</div>
        {item.status === "unread" ? <form action={updateNotificationStateAction} className="mt-3"><input type="hidden" name="workspaceId" value={context.workspaceId}/><input type="hidden" name="notificationId" value={item.id}/><input type="hidden" name="status" value="read"/><button className="text-sm font-semibold">Mark as read</button></form> : null}
      </li>)}</ul>}
    </WorkspaceContent>
  </WorkspacePage>;
}
