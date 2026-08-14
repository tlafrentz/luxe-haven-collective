import { ArrowRight } from "lucide-react";
import { HomepageLink } from "@/components/marketing/homepage-link";
import { getSessionProfile } from "@/lib/auth/session";

const navigation = [
  ["HPM", "/hpm", "header_hpm"],
  ["Guidebook", "/guidebook-studio", "header_guidebook"],
  ["Furnishing", "/furnishing", "header_furnishing"],
  ["Investment Intelligence", "/investment-intelligence", "header_investment"],
  ["Resources", "/resources", "header_resources"],
  ["About", "/about", "header_about"],
] as const;

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
        <nav aria-label="Primary navigation" className="hidden items-center gap-7 lg:flex">
          {navigation.map(([label, href, id]) => (
            <HomepageLink key={href} actionId={id} sourceSection="header" authenticated={authenticated} href={href} className="inline-flex min-h-11 items-center text-sm font-medium transition hover:text-[#9a6a1b] focus-visible:outline-2 focus-visible:outline-offset-4">{label}</HomepageLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <HomepageLink actionId="header_sign_in" sourceSection="header" authenticated={authenticated} href={authenticated ? workspaceHref : "/login"} className="inline-flex min-h-11 items-center rounded-sm border border-[#6f887f] px-5 text-sm font-semibold">
            {authenticated ? "Open Workspace" : "Sign in"}
          </HomepageLink>
          <HomepageLink actionId="header_start_conversation" sourceSection="header" authenticated={authenticated} href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#073f32] px-5 text-sm font-semibold text-white">Start the Conversation <ArrowRight className="size-4" /></HomepageLink>
        </div>
        <details className="group relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-sm border border-[#82958f] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">Menu</summary>
          <div className="absolute right-0 top-13 w-[min(90vw,330px)] rounded-sm border border-[#d8d0c3] bg-[#fbf8f1] p-3 shadow-2xl">
            <nav aria-label="Mobile navigation" className="grid">
              {navigation.map(([label, href, id]) => <HomepageLink key={href} actionId={id} sourceSection="header_mobile" authenticated={authenticated} href={href} className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium hover:bg-[#f0eadf]">{label}</HomepageLink>)}
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
