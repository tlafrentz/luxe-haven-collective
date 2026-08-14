import { ArrowRight, ChevronDown } from "lucide-react";
import { HomepageLink } from "@/components/marketing/homepage-link";
import { getSessionProfile } from "@/lib/auth/session";

const navigation = [
  {
    label: "Solutions",
    id: "header_solutions",
    items: [
      ["Hospitality Management", "/solutions/operations", "header_solution_management"],
      ["Revenue Optimization", "/solutions/revenue", "header_solution_revenue"],
      ["Hospitality Consulting", "/contact?service=hospitality-consulting", "header_solution_consulting"],
      ["Furnishing Services", "/solutions/property-launch", "header_solution_furnishing"],
    ],
  },
  {
    label: "Platform",
    id: "header_platform",
    items: [
      ["HPM", "/hpm", "header_platform_hpm"],
      ["Guidebook Studio", "/guidebook-studio", "header_platform_guidebook"],
      ["Furnishing Studio", "/furnishing", "header_platform_furnishing"],
      ["Investment Intelligence", "/investment-intelligence", "header_platform_investment"],
    ],
  },
  {
    label: "Resources",
    id: "header_resources",
    items: [
      ["Insights", "/resources/insights", "header_resource_insights"],
      ["Playbooks", "/resources/playbooks", "header_resource_playbooks"],
      ["Templates & Checklists", "/resources/templates", "header_resource_templates"],
    ],
  },
] as const;

const directNavigation = [
  ["Properties", "/stays", "header_properties"],
  ["About", "/about", "header_about"],
] as const;

type TrackingContext = Readonly<{ authenticated: boolean; sourceSection: string }>;

function NavigationDropdown({
  group,
  authenticated,
  sourceSection,
}: Readonly<{
  group: (typeof navigation)[number];
}> & TrackingContext) {
  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium transition hover:text-[#9a6a1b] focus-visible:outline-2 focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">
        {group.label}
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute left-1/2 top-[calc(100%-2px)] w-64 -translate-x-1/2 border border-[#d8d0c3] bg-[#fbf8f1] p-2 shadow-xl">
        {group.items.map(([label, href, id]) => (
          <HomepageLink
            key={href}
            actionId={id}
            sourceSection={sourceSection}
            authenticated={authenticated}
            href={href}
            className="flex min-h-11 items-center px-3 text-sm font-medium hover:bg-[#f0eadf] focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
          >
            {label}
          </HomepageLink>
        ))}
      </div>
    </details>
  );
}

export async function SiteHeader() {
  const { user, profile } = await getSessionProfile();
  const authenticated = Boolean(user);
  const workspaceHref = profile?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <header className="relative z-50 border-b border-[#d8d0c3] bg-[#fbf8f1] text-[#17372f]">
      <div className="mx-auto flex min-h-[76px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8">
        <HomepageLink actionId="header_home" sourceSection="header" authenticated={authenticated} href="/" aria-label="Luxe Haven Collective home" className="flex shrink-0 items-center gap-3 text-[#95691f]">
          <span className="font-serif text-3xl leading-none">LH</span>
          <span className="border-l border-[#d4bd8d] pl-3 text-[9px] font-bold uppercase leading-[1.2] tracking-[.14em]">Luxe Haven<br />Collective</span>
        </HomepageLink>

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 xl:flex">
          {navigation.map((group) => (
            <NavigationDropdown key={group.id} group={group} authenticated={authenticated} sourceSection="header" />
          ))}
          {directNavigation.map(([label, href, id]) => (
            <HomepageLink key={href} actionId={id} sourceSection="header" authenticated={authenticated} href={href} className="inline-flex min-h-11 items-center text-sm font-medium transition hover:text-[#9a6a1b] focus-visible:outline-2 focus-visible:outline-offset-4">
              {label}
            </HomepageLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <HomepageLink actionId="header_sign_in" sourceSection="header" authenticated={authenticated} href={authenticated ? workspaceHref : "/login"} className="inline-flex min-h-11 items-center rounded-sm border border-[#6f887f] px-5 text-sm font-semibold">
            {authenticated ? "Open Workspace" : "Sign in"}
          </HomepageLink>
          <HomepageLink actionId="header_start_conversation" sourceSection="header" authenticated={authenticated} href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#073f32] px-5 text-sm font-semibold text-white">Start the Conversation <ArrowRight className="size-4" /></HomepageLink>
        </div>

        <details className="group relative xl:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-sm border border-[#82958f] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">Menu</summary>
          <div className="absolute right-0 top-13 max-h-[calc(100vh-6rem)] w-[min(90vw,350px)] overflow-y-auto rounded-sm border border-[#d8d0c3] bg-[#fbf8f1] p-3 shadow-2xl">
            <nav aria-label="Mobile navigation" className="grid gap-3">
              {navigation.map((group) => (
                <section key={group.id} aria-labelledby={`${group.id}-mobile`}>
                  <h2 id={`${group.id}-mobile`} className="px-3 py-1 text-xs font-bold uppercase tracking-[.14em] text-[#8b6725]">{group.label}</h2>
                  {group.items.map(([label, href, id]) => (
                    <HomepageLink key={href} actionId={id} sourceSection="header_mobile" authenticated={authenticated} href={href} className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium hover:bg-[#f0eadf]">{label}</HomepageLink>
                  ))}
                </section>
              ))}
              <section className="border-t border-[#d8d0c3] pt-2">
                {directNavigation.map(([label, href, id]) => (
                  <HomepageLink key={href} actionId={id} sourceSection="header_mobile" authenticated={authenticated} href={href} className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium hover:bg-[#f0eadf]">{label}</HomepageLink>
                ))}
              </section>
            </nav>
            <div className="mt-2 grid gap-2 border-t border-[#d8d0c3] pt-3">
              <HomepageLink actionId="header_sign_in" sourceSection="header_mobile" authenticated={authenticated} href={authenticated ? workspaceHref : "/login"} className="flex min-h-11 items-center justify-center rounded-sm border border-[#6f887f] px-4 text-sm font-semibold">{authenticated ? "Open Workspace" : "Sign in"}</HomepageLink>
              <HomepageLink actionId="header_start_conversation" sourceSection="header_mobile" authenticated={authenticated} href="/contact" className="flex min-h-11 items-center justify-center rounded-sm bg-[#073f32] px-4 text-sm font-semibold text-white">Start the Conversation</HomepageLink>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
