export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[#171412] py-12 text-primary-foreground">
      <div className="container-shell grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="text-lg font-semibold tracking-[0.28em] uppercase">Luxe Haven</p>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/70">Boutique short-term rental hospitality for memorable guest stays and owner-focused performance.</p>
        </div>
        <div className="text-sm text-primary-foreground/70"><p className="font-semibold text-primary-foreground">Services</p><p className="mt-3">Guest experience</p><p>Revenue optimization</p><p>Owner reporting</p></div>
        <div className="text-sm text-primary-foreground/70"><p className="font-semibold text-primary-foreground">Contact</p><p className="mt-3">hello@luxehavencollective.com</p><p>Available by appointment</p></div>
      </div>
    </footer>
  );
}
