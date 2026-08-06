import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Hammer,
  PackageCheck,
  Sparkles,
  Truck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Furnishing Studio",
  description:
    "Professionally designed, procured, delivered, and installation-ready furnishing packages for hospitality properties.",
};
const images = [
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85",
];
const packages = [
  {
    name: "Essential",
    price: "$4,995",
    ideal: "A focused, guest-ready foundation",
    rooms: "Core rooms",
    timeline: "3–5 weeks",
    features: ["Essential furniture", "Core décor", "Delivery coordination"],
  },
  {
    name: "Elevated",
    price: "$7,995",
    ideal: "A cohesive, professionally curated property",
    rooms: "Up to 3 bed / 2 bath",
    timeline: "4–6 weeks",
    features: [
      "Upgraded furniture",
      "Premium décor",
      "Delivery & installation",
    ],
  },
  {
    name: "Luxury",
    price: "$12,995",
    ideal: "A fully expressive, differentiated stay",
    rooms: "Whole property",
    timeline: "5–8 weeks",
    features: [
      "Custom curation",
      "Art & accessories",
      "White-glove installation",
    ],
  },
];
const rooms = [
  "Living Room",
  "Primary Bedroom",
  "Kitchen & Dining",
  "Bathroom",
  "Outdoor",
  "Workspace",
];
const faqs = [
  [
    "What’s included in a furnishing package?",
    "Design direction, curated product selections, a room-by-room budget, procurement coordination, receiving and installation planning, and launch-readiness handoff.",
  ],
  [
    "Can I substitute products?",
    "Yes. Every selection supports alternatives and replacement review before orders are approved.",
  ],
  [
    "Do you deliver and install?",
    "Delivery and installation scope depends on the selected package and market. Your launch plan makes every responsibility explicit.",
  ],
  [
    "Can I furnish only part of a property?",
    "Yes. Select only the rooms that need transformation during Launch Setup.",
  ],
  [
    "Can I use furniture I already own?",
    "Absolutely. Existing pieces can become constraints in the design brief rather than duplicated purchases.",
  ],
];

export default function FurnishingStudioLandingPage() {
  return (
    <main className="bg-[#f8f5ef] text-[#1e2521]">
      <section className="mx-auto grid min-h-[720px] max-w-[96rem] items-stretch lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-20 lg:px-16">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#9a7142]">
            Luxe Haven Furnishing Studio
          </p>
          <h1 className="mt-6 max-w-xl font-serif text-6xl leading-[.95] md:text-7xl">
            Furnish beautifully.
            <br />
            Launch faster.
            <br />
            <span className="text-[#386f5f]">Earn more.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-stone-600">
            Full-service furnishing packages, curated design, and end-to-end
            support for short-term rentals—from first concept to launch ready.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="#packages"
              className="inline-flex items-center gap-2 rounded-full bg-[#17483b] px-7 py-3.5 text-sm font-semibold text-white"
            >
              Explore packages <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#examples"
              className="rounded-full border border-[#8fa69d] bg-white px-7 py-3.5 text-sm font-semibold"
            >
              See examples
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              [<Sparkles key="i" />, "Expert design"],
              [<PackageCheck key="i" />, "Quality products"],
              [<Truck key="i" />, "Delivered & tracked"],
              [<Hammer key="i" />, "Guest ready"],
            ].map(([icon, label]) => (
              <div
                key={String(label)}
                className="flex items-center gap-2 text-stone-600 [&_svg]:size-4 [&_svg]:text-[#386f5f]"
              >
                {icon}
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-h-[520px]">
          <Image
            src={images[0]}
            alt="Warm, professionally furnished hospitality living room"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f8f5ef] via-transparent to-transparent lg:block hidden" />
        </div>
      </section>
      <section id="packages" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Heading
            eyebrow="Compare packages"
            title="Choose the right launch experience"
            description="A clear scope, estimated investment, and support level for every property."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {packages.map((pkg, index) => (
              <article
                key={pkg.name}
                className={`rounded-[2rem] border p-7 ${index === 1 ? "border-[#17483b] bg-[#f1f7f4] ring-2 ring-[#bad2c8]" : "border-stone-200"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7142]">
                      {pkg.rooms}
                    </p>
                    <h3 className="mt-2 font-serif text-3xl">{pkg.name}</h3>
                  </div>
                  {index === 1 ? (
                    <span className="rounded-full bg-[#17483b] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-5 text-4xl font-semibold">{pkg.price}</p>
                <p className="mt-3 min-h-12 text-sm leading-6 text-stone-500">
                  {pkg.ideal}
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 text-[#386f5f]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center gap-2 text-xs text-stone-500">
                  <Clock3 className="size-4" /> {pkg.timeline} expected timeline
                </div>
                <Link
                  href={
                    index === 1
                      ? "/products/elevated-furnishing-package"
                      : "/get-started?product=furnishing"
                  }
                  className={`mt-7 inline-flex w-full justify-center rounded-full px-5 py-3 text-sm font-semibold ${index === 1 ? "bg-[#17483b] text-white" : "border"}`}
                >
                  Choose {pkg.name}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Heading
            eyebrow="Room packages"
            title="Every room works harder"
            description="Explore hospitality-focused spaces designed for beauty, durability, and effortless guest use."
          />
          <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {rooms.map((room, index) => (
              <article
                key={room}
                className="group overflow-hidden rounded-[1.5rem] bg-white"
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    src={images[index % images.length]}
                    alt=""
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex items-center justify-between p-5">
                  <h3 className="font-serif text-xl">{room}</h3>
                  <ArrowRight className="size-4 text-[#386f5f]" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="examples" className="bg-[#173f35] py-24 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d2b786]">
              Real projects · Real results
            </p>
            <h2 className="mt-4 font-serif text-5xl">
              Designed for the stay guests remember.
            </h2>
            <p className="mt-5 leading-7 text-white/65">
              See the material palette, room plan, budget, project duration, and
              final guest-ready result—not just a styled photograph.
            </p>
            <dl className="mt-8 grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-white/50">Property</dt>
                <dd className="mt-2 font-semibold">Desert Retreat</dd>
              </div>
              <div>
                <dt className="text-xs text-white/50">Duration</dt>
                <dd className="mt-2 font-semibold">5 weeks</dd>
              </div>
              <div>
                <dt className="text-xs text-white/50">Style</dt>
                <dd className="mt-2 font-semibold">Modern warm</dd>
              </div>
            </dl>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem]">
            <Image
              src={images[1]}
              alt="Completed Luxe Haven furnishing project"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>
      <section className="bg-white py-24">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2">
          <div>
            <Heading
              eyebrow="Frequently asked"
              title="Plan with confidence"
              description="Clear answers before your project begins."
            />
            <div className="mt-8 divide-y border-y">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                    {question}
                    <span className="text-xl text-[#386f5f] group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-stone-500">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] bg-[#f3eee5] p-8 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7142]">
              Find my best fit
            </p>
            <h2 className="mt-4 font-serif text-4xl">
              What best describes your property?
            </h2>
            <div className="mt-7 space-y-3">
              {[
                "A new property",
                "Updating an existing property",
                "Multiple properties",
                "I’m still exploring",
              ].map((answer) => (
                <Link
                  key={answer}
                  href={`/get-started?product=furnishing&project=${encodeURIComponent(answer)}`}
                  className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 text-sm font-semibold"
                >
                  {answer}
                  <ArrowRight className="size-4 text-[#386f5f]" />
                </Link>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-stone-500">
              Takes about 2 minutes
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7142]">
        {eyebrow}
      </p>
      <h2 className="mt-4 max-w-3xl font-serif text-5xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
        {description}
      </p>
    </header>
  );
}
