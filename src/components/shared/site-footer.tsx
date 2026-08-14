import { HomepageLink } from "@/components/marketing/homepage-link";
import { getSessionProfile } from "@/lib/auth/session";

const groups = [
  ["Platform", [["HPM","/hpm"],["Guidebook Studio","/guidebook-studio"],["Furnishing","/furnishing"],["Investment Intelligence","/investment-intelligence"]]],
  ["Resources", [["Owner Playbooks","/resources/playbooks"],["Insights","/resources/insights"],["Templates & Checklists","/resources/templates"]]],
  ["Company", [["About","/about"],["Our Approach","/approach"],["Contact","/contact"]]],
] as const;

export async function SiteFooter() {
  const { user } = await getSessionProfile();
  const authenticated = Boolean(user);
  return (
    <footer className="border-t border-[#d8d0c3] bg-[#fbf8f1] text-[#233a33]">
      <div className="mx-auto grid max-w-[1340px] gap-10 px-6 py-12 sm:px-10 md:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div>
          <HomepageLink actionId="footer_home" sourceSection="footer" authenticated={authenticated} href="/" className="flex items-center gap-3 text-[#95691f]"><span className="font-serif text-3xl">LH</span><span className="text-[9px] font-bold uppercase tracking-[.14em]">Luxe Haven<br/>Collective</span></HomepageLink>
          <p className="mt-5 max-w-xs text-xs leading-5 text-[#59635f]">An operating system for independent hospitality owners—connecting performance, guest experience, execution, and learning.</p>
        </div>
        {groups.map(([title,links])=><div key={title}><h2 className="text-[10px] font-bold uppercase tracking-[.12em]">{title}</h2><ul className="mt-4 grid gap-1">{links.map(([label,href])=><li key={href}><HomepageLink actionId={`footer_${label.toLowerCase().replaceAll(/[^a-z]+/g,"_")}`} sourceSection="footer" authenticated={authenticated} href={href} className="inline-flex min-h-9 items-center text-xs text-[#59635f] hover:text-[#07513f]">{label}</HomepageLink></li>)}</ul></div>)}
        <div className="lg:border-l lg:border-[#d8d0c3] lg:pl-8"><h2 className="text-[10px] font-bold uppercase tracking-[.12em]">Texas Notary Services</h2><HomepageLink actionId="footer_texas_notary" sourceSection="footer" authenticated={authenticated} href="/notary" className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-[#07513f]">Learn more →</HomepageLink></div>
      </div>
      <div className="border-t border-[#d8d0c3]"><div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-4 px-6 py-5 text-[10px] text-[#68716d] sm:px-10"><p>© {new Date().getFullYear()} Luxe Haven Collective. All rights reserved.</p><div className="flex flex-wrap gap-5"><HomepageLink actionId="footer_privacy" sourceSection="footer" authenticated={authenticated} href="/privacy">Privacy Policy</HomepageLink><HomepageLink actionId="footer_terms" sourceSection="footer" authenticated={authenticated} href="/terms">Terms of Service</HomepageLink><HomepageLink actionId="footer_notary_disclaimer" sourceSection="footer" authenticated={authenticated} href="/notary">Notary Disclaimer</HomepageLink></div></div></div>
    </footer>
  );
}
