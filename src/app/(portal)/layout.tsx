import Link from "next/link";

const links = [{ href: "/dashboard", label: "Dashboard" }, { href: "/properties", label: "Properties" }, { href: "/bookings", label: "Bookings" }, { href: "/messages", label: "Messages" }];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-muted/25"><aside className="fixed hidden h-full w-72 border-r border-border bg-card p-8 md:block"><Link href="/" className="text-lg font-semibold tracking-[0.24em] uppercase">Luxe Haven</Link><nav className="mt-10 grid gap-2">{links.map((link) => <Link className="rounded-2xl px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground" key={link.href} href={link.href}>{link.label}</Link>)}</nav></aside><main className="md:pl-72"><div className="container-shell py-10">{children}</div></main></div>;
}
