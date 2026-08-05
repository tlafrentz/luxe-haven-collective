import {
  Bath,
  BedDouble,
  MapPin,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages, mesaAirbnbUrl } from "@/lib/mesa-airbnb";

export default function StaysPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-12">
        <div className="container-shell grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              Stay with us
            </p>
            <h1 className="mt-5 font-serif text-5xl leading-[1.08] md:text-6xl">
              Exceptional stays.
              <br />
              Thoughtful details.
              <br />
              Memorable locations.
            </h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-stone-600">
              Experience the Luxe Haven difference in a handpicked Mesa property
              backed by hospitality standards and attentive guest care.
            </p>
          </div>
          <div className="relative aspect-[1.7/1] overflow-hidden rounded-xl">
            <SafeImage
              src={mesaAirbnbImages[0]}
              alt="Thoughtfully designed Mesa getaway"
              fill
              priority
              className="object-cover"
              sizes="(min-width:1024px) 55vw,100vw"
            />
          </div>
        </div>
      </section>
      <section className="pb-12">
        <div className="container-shell">
          <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1fr_1fr_.65fr_auto]">
            <label className="grid gap-1 text-xs font-semibold">
              Where are you going?
              <input
                value="Mesa, Arizona"
                readOnly
                className="rounded-md border px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Check-in — Check-out
              <input
                type="text"
                placeholder="Add dates on Airbnb"
                readOnly
                className="rounded-md border px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Guests
              <input
                value="1 guest"
                readOnly
                className="rounded-md border px-3 py-2 font-normal"
              />
            </label>
            <a
              href={mesaAirbnbUrl}
              target="_blank"
              rel="noreferrer"
              className="self-end rounded-md bg-emerald-900 px-6 py-3 text-center text-sm font-semibold text-white"
            >
              Search availability
            </a>
          </div>
        </div>
      </section>
      <section className="pb-16">
        <div className="container-shell">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
                Featured property
              </p>
              <h2 className="mt-3 font-serif text-4xl">
                Thoughtfully Designed Mesa Getaway
              </h2>
            </div>
          </div>
          <article className="mt-7 overflow-hidden rounded-xl border bg-white lg:grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="grid grid-cols-2 gap-1">
              <div className="relative col-span-2 aspect-[2.1/1]">
                <SafeImage
                  src={mesaAirbnbImages[0]}
                  alt="Mesa getaway living room"
                  fill
                  className="object-cover"
                  sizes="70vw"
                />
              </div>
              {mesaAirbnbImages.slice(1, 5).map((image, index) => (
                <div key={image} className="relative aspect-[1.5/1]">
                  <SafeImage
                    src={image}
                    alt={`Mesa getaway listing photo ${index + 2}`}
                    fill
                    className="object-cover"
                    sizes="35vw"
                  />
                </div>
              ))}
            </div>
            <div className="p-7 lg:p-10">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#a56b19]">
                <MapPin className="size-4" />
                Mesa, Arizona
              </p>
              <h3 className="mt-3 font-serif text-4xl">
                Thoughtfully Designed Mesa Getaway
              </h3>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                A comfortable two-bedroom Mesa retreat designed for easy
                arrivals, relaxing stays, and convenient access to the East
                Valley.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <span className="flex gap-2">
                  <BedDouble className="size-5" />2 bedrooms
                </span>
                <span className="flex gap-2">
                  <Bath className="size-5" />1 bathroom
                </span>
                <span className="flex gap-2">
                  <Users className="size-5" />2 beds
                </span>
                <span className="flex gap-2">
                  <Star className="size-5" />
                  Airbnb listing
                </span>
              </div>
              <a
                href={mesaAirbnbUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex rounded-md bg-emerald-900 px-6 py-3 text-sm font-semibold text-white"
              >
                View and book on Airbnb →
              </a>
              <p className="mt-3 text-xs text-stone-500">
                Availability, pricing, and booking are securely completed on
                Airbnb.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="bg-[#f5efe5] py-14">
        <div className="container-shell">
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Why stay with Luxe Haven
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {[
              [
                "Thoughtful setup",
                "A practical, comfortable home prepared for real stays.",
              ],
              [
                "Flexible booking",
                "Current policies and availability are shown on Airbnb.",
              ],
              ["Guest support", "Clear communication for a confident arrival."],
              [
                "Hospitality standards",
                "An experience shaped by operator care.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="text-center">
                <ShieldCheck className="mx-auto size-7 text-emerald-800" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-stone-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
