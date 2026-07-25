import Link from "next/link";
import {
  ProductActivity,
  ProductHeader,
  ProductOverview,
  ProductPage,
  ProductSupport,
  ProductWorkspace,
} from "@/components/product-page-blueprint";
import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  House,
  PlugZap,
  Settings2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  getOperationalSurfaceProjection,
} from "@/features/operational-surfaces";
import {
  OperationalActivityTimeline,
  OperationalQualityIndicator,
} from "@/components/product/operational";
import { requireUser } from "@/lib/auth/session";

type WorkspaceSection = Readonly<{
  id: string;
  title: string;
  question: string;
  description: string;
  action: string;
  status: "complete" | "attention" | "not-started";
  statusLabel: string;
  icon: LucideIcon;
}>;

const baseSections: readonly WorkspaceSection[] = [
  {
    id: "organization",
    title: "Organization",
    question: "Who are we?",
    description: "Set your business identity, branding, location, and operating defaults.",
    action: "Review organization",
    status: "complete",
    statusLabel: "Configured",
    icon: Building2,
  },
  {
    id: "team",
    title: "Team",
    question: "Who works here?",
    description: "Invite members and control their workspace and property access.",
    action: "Manage team",
    status: "not-started",
    statusLabel: "Review access",
    icon: UsersRound,
  },
  {
    id: "properties",
    title: "Properties",
    question: "What business assets belong here?",
    description: "Choose the connected properties included in this workspace and portfolio.",
    action: "Review properties",
    status: "not-started",
    statusLabel: "Not synchronized",
    icon: House,
  },
  {
    id: "connected-systems",
    title: "Connected Systems",
    question: "What systems power my business?",
    description: "Connect your PMS and other business tools to power Luxe Haven intelligence.",
    action: "Manage connections",
    status: "attention",
    statusLabel: "Review connection",
    icon: PlugZap,
  },
  {
    id: "notifications",
    title: "Notifications",
    question: "How do I stay informed?",
    description: "Choose which alerts, summaries, and digests reach you—and how often.",
    action: "Set notifications",
    status: "not-started",
    statusLabel: "Set up",
    icon: Bell,
  },
  {
    id: "preferences",
    title: "Preferences",
    question: "How should Luxe Haven work for me?",
    description: "Set workspace display, reporting, measurement, and dashboard defaults.",
    action: "Set preferences",
    status: "not-started",
    statusLabel: "Using defaults",
    icon: Settings2,
  },
];

export default async function WorkspacePage() {
  const { user, profile } = await requireUser();
  const operations = await getOperationalSurfaceProjection({
    principal: {
      userId: user.id,
      workspaceId: user.id,
      role: profile?.role ?? "guest",
    },
    workspaceLabel: profile?.full_name
      ? `${profile.full_name}'s Workspace`
      : "Luxe Haven Workspace",
  });
  const connected = operations.properties.filter(
    ({ property }) => property.connectionState === "connected",
  ).length;
  const sections = baseSections.map((section): WorkspaceSection => {
    if (section.id === "organization")
      return {
        ...section,
        status: profile?.full_name ? "complete" : "attention",
        statusLabel: profile?.full_name ? "Configured" : "Needs identity",
      };
    if (section.id === "properties")
      return {
        ...section,
        status: operations.properties.length ? "complete" : "not-started",
        statusLabel: operations.properties.length
          ? `${operations.properties.length} available`
          : "Import properties",
      };
    if (section.id === "connected-systems")
      return {
        ...section,
        status:
          operations.synchronization.status === "succeeded"
            ? "complete"
            : "attention",
        statusLabel: connected
          ? `${connected} connected`
          : "Connection needed",
      };
    return section;
  });
  const completed = sections.filter(
    (section) => section.status === "complete",
  ).length;
  return (
    <ProductPage width="medium" pattern="settings-sections" density="comfortable">
      <ProductHeader
        eyebrow="Business configuration"
        title="Workspace"
        description="Configure how your hospitality business is represented, connected, and experienced across Luxe Haven."
        context={
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-950 text-sm font-semibold text-white">LH</span>
          <span>
            <span className="block text-sm font-semibold text-stone-950">Luxe Haven Collective</span>
            <span className="block text-xs text-stone-500">Owner workspace</span>
          </span>
        </div>
        }
      />

      <ProductOverview aria-labelledby="workspace-overview" className="overflow-hidden rounded-3xl border border-stone-200 bg-stone-950 text-white shadow-sm">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Workspace overview</p>
                <h2 id="workspace-overview" className="mt-3 text-2xl font-semibold">Your foundation is taking shape.</h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                <CircleUserRound aria-hidden="true" className="h-5 w-5 text-amber-200" />
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-300">
              Complete the essentials to unlock a reliable view of your portfolio and personalized intelligence.
            </p>
            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>Core setup</span>
                <span>{completed} of {sections.length} complete</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 rounded-full bg-amber-200" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3">
            <OverviewMetric label="Organization" value={profile?.full_name ? "Configured" : "Needs identity"} complete={Boolean(profile?.full_name)} attention={!profile?.full_name} />
            <OverviewMetric label="Team" value="Review access" />
            <OverviewMetric label="Properties" value={`${operations.properties.length} available`} complete={operations.properties.length > 0} />
            <OverviewMetric label="Connected systems" value={connected ? `${connected} active` : "Connection needed"} complete={operations.synchronization.status === "succeeded"} attention={operations.synchronization.status !== "succeeded"} />
            <OverviewMetric label="Notifications" value="Needs setup" attention />
            <OverviewMetric label="Preferences" value="Defaults" />
          </div>
        </div>
      </ProductOverview>

      <ProductWorkspace aria-labelledby="configuration-heading">
        <div className="mb-5">
          <h2 id="configuration-heading" className="text-xl font-semibold text-stone-950">Configure your business</h2>
          <p className="mt-1 text-sm text-stone-600">Start with the essentials. More controls appear as your workspace grows.</p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          {sections.map((section) => (
            <WorkspaceSectionRow key={section.id} section={section} />
          ))}
        </div>
      </ProductWorkspace>

      <ProductSupport className="flex flex-col justify-between gap-5 rounded-3xl border border-teal-900/10 bg-teal-950 p-6 text-white sm:flex-row sm:items-center sm:p-7">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <PlugZap aria-hidden="true" className="h-5 w-5 text-teal-200" />
          </span>
          <div>
            <h2 className="font-semibold">{operations.synchronization.status === "succeeded" ? "Operational connection is current" : "Connect your property management system"}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-teal-100/75">
              {operations.synchronization.status === "succeeded" ? `Last synchronized ${operations.synchronization.lastSuccessfulAt ?? "recently"}.` : "Bring in properties and reservation data to unlock live operations and intelligence."}
            </p>
          </div>
        </div>
        <Link href="#connected-systems" className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-teal-950 outline-none hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-950">
          View connections
        </Link>
      </ProductSupport>

      <ProductActivity aria-labelledby="workspace-activity">
        <div className="mb-5">
          <h2 id="workspace-activity" className="text-xl font-semibold text-stone-950">Recent configuration activity</h2>
          <p className="mt-1 text-sm text-stone-600">A clear record of what changed and which setup work can continue.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex justify-end"><OperationalQualityIndicator status={operations.quality.status} /></div>
          {operations.activity.length ? <OperationalActivityTimeline activities={operations.activity} /> : <p className="text-sm text-stone-500">Configuration and synchronization activity will appear after your first connected update.</p>}
        </div>
      </ProductActivity>
    </ProductPage>
  );
}

function OverviewMetric({ label, value, complete = false, attention = false }: Readonly<{ label: string; value: string; complete?: boolean; attention?: boolean }>) {
  return (
    <div className="min-h-28 border-b border-r border-white/10 p-4 sm:p-5">
      <span className={["flex h-6 w-6 items-center justify-center rounded-full", complete ? "bg-teal-300/15 text-teal-200" : attention ? "bg-amber-200/15 text-amber-200" : "bg-white/10 text-stone-400"].join(" ")}>
        {complete ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : attention ? <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function WorkspaceSectionRow({ section }: Readonly<{ section: WorkspaceSection }>) {
  const Icon = section.icon;
  const statusClasses = section.status === "complete"
    ? "bg-teal-50 text-teal-800"
    : section.status === "attention"
      ? "bg-amber-50 text-amber-800"
      : "bg-stone-100 text-stone-600";

  return (
    <article id={section.id} className="group grid scroll-mt-28 gap-4 border-b border-stone-200 p-5 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-700 transition-colors group-hover:border-stone-300 group-hover:bg-white">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="font-semibold text-stone-950">{section.title}</h3>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses}`}>{section.statusLabel}</span>
        </div>
        <p className="mt-1 text-xs font-medium text-stone-500">{section.question}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{section.description}</p>
      </div>
      <button type="button" className="inline-flex items-center gap-1.5 justify-self-start rounded-lg px-2 py-2 text-sm font-semibold text-stone-700 outline-none hover:bg-stone-100 hover:text-stone-950 focus-visible:ring-2 focus-visible:ring-teal-600 sm:justify-self-end">
        {section.action}
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </article>
  );
}
