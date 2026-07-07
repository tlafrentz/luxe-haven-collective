import { notFound } from "next/navigation";
import { CalendarDays, Check, MapPin } from "lucide-react";
import { getPropertyBySlug } from "@/lib/properties";
import { currency } from "@/lib/utils";

export default async function StayDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = getPropertyBySlug(slug);
  if (!property) notFound();
  return (
    <main className="py-12"><div className="container-shell"><div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]"><div><div className="h-[520px] rounded-[2rem] bg-cover bg-center" style={{ backgroundImage: `url(${property.images[0]})` }} /><div className="mt-8"><p className="flex items-center gap-2 text-muted-foreground"><MapPin size={18} /> {property.city}, {property.state}</p><h1 className="mt-3 font-serif text-5xl">{property.name}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{property.description}</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{property.amenities.map((amenity) => <p key={amenity} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm"><Check size={16} className="text-accent" />{amenity}</p>)}</div></div></div><aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-sm"><p className="text-2xl font-semibold">{currency.format(property.nightly_rate)} <span className="text-sm font-normal text-muted-foreground">/ night</span></p><div className="mt-6 grid gap-3"><div className="rounded-2xl border border-border p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dates</p><p className="mt-2 flex items-center gap-2"><CalendarDays size={16} /> Select dates soon</p></div><button className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Request Booking</button><p className="text-center text-xs text-muted-foreground">Booking engine placeholder for Sprint 3.</p></div></aside></div></div></main>
  );
}
