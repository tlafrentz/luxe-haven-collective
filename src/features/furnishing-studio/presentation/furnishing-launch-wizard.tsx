"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Home,
  PackageCheck,
  Sparkles,
} from "lucide-react";

type Row = Record<string, unknown>;
const steps = ["Property", "Package", "Rooms", "Budget", "Ready"] as const;
const roomChoices = [
  "Living Room",
  "Dining Room",
  "Kitchen",
  "Primary Bedroom",
  "Guest Bedroom",
  "Bathroom",
  "Office",
  "Outdoor",
];
const images = [
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85",
];

export function FurnishingLaunchWizard({
  properties,
  packages,
  variants,
  rooms,
  createAction,
}: Readonly<{
  properties: readonly Row[];
  packages: readonly Row[];
  variants: readonly Row[];
  rooms: readonly Row[];
  createAction: (formData: FormData) => Promise<void>;
}>) {
  const [step, setStep] = useState(0);
  const [propertyId, setPropertyId] = useState("");
  const [packageId, setPackageId] = useState(
    String(packages[1]?.id ?? packages[0]?.id ?? ""),
  );
  const matchingVariants = variants.filter(
    (item) => String(item.package_id) === packageId,
  );
  const [variantId, setVariantId] = useState("");
  const [selectedRooms, setSelectedRooms] = useState([
    "Living Room",
    "Dining Room",
    "Kitchen",
    "Primary Bedroom",
  ]);
  const [budget, setBudget] = useState(15000);
  const [style, setStyle] = useState("Modern warm");
  const [priority, setPriority] = useState("Launch speed");
  const property =
    properties.find((item) => String(item.id) === propertyId) ?? properties[0];
  const pkg =
    packages.find((item) => String(item.id) === packageId) ?? packages[0];
  const variant =
    matchingVariants.find((item) => String(item.id) === variantId) ??
    matchingVariants[0];
  const effectiveVariantId = variantId || String(variant?.id ?? "");
  const estimated = Number(
    variant?.estimated_budget ?? pkg?.starting_budget ?? budget,
  );
  const days = Number(variant?.estimated_install_days ?? 2);
  const progress = ((step + 1) / steps.length) * 100;
  const canContinue =
    step === 0
      ? Boolean(propertyId)
      : step === 1
        ? Boolean(packageId && effectiveVariantId)
        : step === 2
          ? selectedRooms.length > 0
          : true;

  const suggestedRooms = useMemo(() => {
    const ids = new Set(matchingVariants.map((item) => String(item.id)));
    const values = rooms
      .filter((item) => ids.has(String(item.variant_id)))
      .map((item) => String(item.name));
    return values.length ? [...new Set(values)] : roomChoices;
  }, [matchingVariants, rooms]);

  if (!properties.length)
    return (
      <main className="mx-auto max-w-3xl py-16">
        <section className="rounded-[2rem] border bg-white p-10 text-center">
          <h1 className="font-serif text-4xl">
            Your active projects are already underway
          </h1>
          <p className="mt-3 text-stone-600">
            Open Furnishing Studio to review design, procurement, installation,
            and launch readiness.
          </p>
          <Link
            href="/dashboard/furnishing"
            className="mt-6 inline-flex rounded-full bg-[#17483b] px-6 py-3 text-sm font-semibold text-white"
          >
            Open Furnishing Studio
          </Link>
        </section>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1e2521]">
      <header className="border-b border-[#ddd3c4] bg-[#fbf8f2] px-5 py-5">
        <div className="mx-auto flex max-w-[92rem] items-center justify-between">
          <div>
            <Link
              href="/dashboard/furnishing"
              className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7142]"
            >
              Furnishing Studio
            </Link>
            <h1 className="mt-1 font-serif text-2xl">Launch your property</h1>
          </div>
          <p className="hidden text-sm text-stone-500 sm:block">
            Professional design · Curated products · Delivered & installed
          </p>
        </div>
      </header>
      <div className="border-b border-[#ddd3c4] bg-white">
        <ol className="mx-auto flex max-w-4xl items-start px-4 py-5">
          {steps.map((label, index) => (
            <li
              key={label}
              className="relative flex flex-1 flex-col items-center"
            >
              {index ? (
                <span
                  className={`absolute right-1/2 top-3.5 h-px w-full ${index <= step ? "bg-[#17483b]" : "bg-stone-200"}`}
                />
              ) : null}
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                className="relative z-10 flex flex-col items-center gap-2"
              >
                <span
                  className={`grid size-7 place-items-center rounded-full border text-xs font-bold ${index < step ? "border-[#17483b] bg-[#17483b] text-white" : index === step ? "border-[#17483b] bg-white text-[#17483b] ring-4 ring-[#dcebe5]" : "border-stone-300 bg-white text-stone-400"}`}
                >
                  {index < step ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="text-[11px] font-semibold text-stone-600">
                  {label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="mx-auto grid max-w-[92rem] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[2rem] border border-[#ddd3c4] bg-white p-6 shadow-[0_18px_60px_rgba(70,55,35,.08)] md:p-10">
          <header>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7142]">
              Launch setup · {steps[step]}
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              {
                [
                  "Confirm your property",
                  "Choose your furnishing package",
                  "Select the spaces we’ll transform",
                  "Set your budget and priorities",
                  "Your launch project is ready",
                ][step]
              }
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-stone-600">
              {
                [
                  "Start with the property that will become guest-ready.",
                  "Choose the level of design, curation, delivery, and installation support.",
                  "Build the project around the rooms that matter most to your guests.",
                  "We’ll optimize selections against your target and launch timeline.",
                  "From concept to completion, your Luxe Haven team will guide every milestone.",
                ][step]
              }
            </p>
          </header>
          <div className="mt-8">
            {step === 0 ? (
              <PropertyStage
                properties={properties}
                selected={propertyId}
                onSelect={setPropertyId}
              />
            ) : null}
            {step === 1 ? (
              <PackageStage
                packages={packages}
                variants={variants}
                selectedPackage={packageId}
                selectedVariant={effectiveVariantId}
                onPackage={(id) => {
                  setPackageId(id);
                  setVariantId("");
                }}
                onVariant={setVariantId}
              />
            ) : null}
            {step === 2 ? (
              <RoomsStage
                rooms={suggestedRooms}
                selected={selectedRooms}
                onChange={setSelectedRooms}
              />
            ) : null}
            {step === 3 ? (
              <BudgetStage
                budget={budget}
                onBudget={setBudget}
                style={style}
                onStyle={setStyle}
                priority={priority}
                onPriority={setPriority}
                estimated={estimated}
              />
            ) : null}
            {step === 4 ? (
              <ReadyStage
                property={property}
                pkg={pkg}
                rooms={selectedRooms}
                budget={budget}
                days={days}
              />
            ) : null}
          </div>
          <div className="mt-9 flex items-center justify-between border-t pt-6">
            <button
              type="button"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-stone-600 disabled:invisible"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            {step < 4 ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((value) => Math.min(4, value + 1))}
                className="inline-flex items-center gap-2 rounded-full bg-[#17483b] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Confirm & continue <ArrowRight className="size-4" />
              </button>
            ) : (
              <form action={createAction}>
                {selectedRooms.map((room) => (
                  <input key={room} type="hidden" name="scope" value={room} />
                ))}
                <input
                  type="hidden"
                  name="propertyId"
                  value={String(property.id)}
                />
                <input type="hidden" name="packageId" value={String(pkg.id)} />
                <input
                  type="hidden"
                  name="variantId"
                  value={effectiveVariantId}
                />
                <input
                  type="hidden"
                  name="name"
                  value={`${String(property.name)} Furnishing Project`}
                />
                <input type="hidden" name="targetBudget" value={budget} />
                <input type="hidden" name="style" value={style} />
                <input type="hidden" name="priority" value={priority} />
                <button className="inline-flex items-center gap-2 rounded-full bg-[#17483b] px-7 py-3 text-sm font-semibold text-white">
                  Start designing <Sparkles className="size-4" />
                </button>
              </form>
            )}
          </div>
        </section>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-[#d7cdbd] bg-white shadow-xl">
            <div className="relative aspect-[4/3]">
              <Image
                src={String(property?.featured_image || images[1])}
                alt=""
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <p className="text-[10px] uppercase tracking-[.2em] text-[#e5cda8]">
                  Your launch project
                </p>
                <h3 className="mt-2 font-serif text-3xl">
                  {String(property?.name ?? "Your property")}
                </h3>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <Summary
                icon={<PackageCheck />}
                label="Package"
                value={String(pkg?.name ?? "Choose a package")}
              />
              <Summary
                icon={<Home />}
                label="Rooms"
                value={`${selectedRooms.length} selected`}
              />
              <Summary
                icon={<CircleDollarSign />}
                label="Target budget"
                value={money(budget)}
              />
              <Summary
                icon={<CalendarDays />}
                label="Estimated installation"
                value={`${days} days`}
              />
              <div className="pt-2">
                <div className="flex justify-between text-xs font-semibold text-stone-500">
                  <span>Setup progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-[#3b826d] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function PropertyStage({
  properties,
  selected,
  onSelect,
}: {
  properties: readonly Row[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {properties.map((property, index) => (
        <button
          key={String(property.id)}
          type="button"
          onClick={() => onSelect(String(property.id))}
          className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-1 hover:shadow-lg ${selected === String(property.id) ? "border-[#17483b] ring-2 ring-[#b8d3c9]" : "border-stone-200"}`}
        >
          <div className="relative aspect-[16/8]">
            <Image
              src={String(
                property.featured_image || images[index % images.length],
              )}
              alt=""
              fill
              className="object-cover"
            />
            {selected === String(property.id) ? (
              <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-[#17483b] text-white">
                <Check className="size-4" />
              </span>
            ) : null}
          </div>
          <div className="p-5">
            <h3 className="font-serif text-2xl">{String(property.name)}</h3>
            <p className="mt-1 text-sm text-stone-500">
              {[property.address_line_1, property.city, property.state]
                .filter(Boolean)
                .join(", ")}
            </p>
            <div className="mt-4 flex gap-4 text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <BedDouble className="size-3.5" />{" "}
                {String(property.bedrooms ?? "—")} beds
              </span>
              <span>{String(property.bathrooms ?? "—")} baths</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
function PackageStage({
  packages,
  variants,
  selectedPackage,
  selectedVariant,
  onPackage,
  onVariant,
}: {
  packages: readonly Row[];
  variants: readonly Row[];
  selectedPackage: string;
  selectedVariant: string;
  onPackage: (id: string) => void;
  onVariant: (id: string) => void;
}) {
  const labels = ["Essential", "Elevated", "Luxury"];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((pkg, index) => {
          const active = selectedPackage === String(pkg.id);
          const packageVariants = variants.filter(
            (item) => String(item.package_id) === String(pkg.id),
          );
          const starting = Number(
            packageVariants[0]?.estimated_budget ?? pkg.starting_budget,
          );
          return (
            <button
              key={String(pkg.id)}
              type="button"
              onClick={() => onPackage(String(pkg.id))}
              className={`rounded-2xl border p-5 text-left ${active ? "border-[#17483b] bg-[#f2f7f4] ring-2 ring-[#b8d3c9]" : "border-stone-200"}`}
            >
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7142]">
                {labels[index] ?? String(pkg.budget_tier)}
              </p>
              <h3 className="mt-2 font-serif text-2xl">{String(pkg.name)}</h3>
              <p className="mt-3 text-2xl font-semibold">{money(starting)}</p>
              <p className="text-xs text-stone-500">starting estimate</p>
              <ul className="mt-5 space-y-2 text-xs text-stone-600">
                <li>✓ Curated room design</li>
                <li>✓ Product selections</li>
                <li>✓ Delivery coordination</li>
                <li>✓ Installation planning</li>
              </ul>
            </button>
          );
        })}
      </div>
      <label className="mt-6 block text-sm font-semibold">
        Property configuration
        <select
          value={selectedVariant}
          onChange={(event) => onVariant(event.target.value)}
          className="mt-2 block w-full rounded-xl border bg-white px-4 py-3"
        >
          <option value="">Choose the best-fit configuration</option>
          {variants
            .filter((item) => String(item.package_id) === selectedPackage)
            .map((item) => (
              <option key={String(item.id)} value={String(item.id)}>
                {String(item.name)} · {money(Number(item.estimated_budget))}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
function RoomsStage({
  rooms,
  selected,
  onChange,
}: {
  rooms: readonly string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const all = [...new Set([...rooms, ...roomChoices])];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {all.map((room, index) => {
        const active = selected.includes(room);
        return (
          <button
            key={room}
            type="button"
            onClick={() =>
              onChange(
                active
                  ? selected.filter((item) => item !== room)
                  : [...selected, room],
              )
            }
            className={`relative overflow-hidden rounded-2xl border text-left ${active ? "border-[#17483b] ring-2 ring-[#b8d3c9]" : "border-stone-200"}`}
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={images[index % images.length]}
                alt=""
                fill
                className={`object-cover ${active ? "" : "grayscale-[35%] opacity-75"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              {active ? (
                <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-white text-[#17483b]">
                  <Check className="size-4" />
                </span>
              ) : null}
              <p className="absolute inset-x-0 bottom-0 p-4 text-sm font-semibold text-white">
                {room}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
function BudgetStage({
  budget,
  onBudget,
  style,
  onStyle,
  priority,
  onPriority,
  estimated,
}: {
  budget: number;
  onBudget: (value: number) => void;
  style: string;
  onStyle: (value: string) => void;
  priority: string;
  onPriority: (value: string) => void;
  estimated: number;
}) {
  const healthy = budget >= estimated * 0.9;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <label className="text-sm font-semibold">
        Target furnishing budget
        <div className="mt-2 flex items-center rounded-xl border px-4">
          <span className="text-stone-400">$</span>
          <input
            type="number"
            min="1000"
            step="500"
            value={budget}
            onChange={(event) => onBudget(Number(event.target.value))}
            className="h-12 w-full px-2 outline-none"
          />
        </div>
      </label>
      <label className="text-sm font-semibold">
        Design style
        <select
          value={style}
          onChange={(event) => onStyle(event.target.value)}
          className="mt-2 block h-12 w-full rounded-xl border px-4"
        >
          <option>Modern warm</option>
          <option>Coastal relaxed</option>
          <option>Elevated minimal</option>
          <option>Mountain contemporary</option>
          <option>Colorful boutique</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Top priority
        <select
          value={priority}
          onChange={(event) => onPriority(event.target.value)}
          className="mt-2 block h-12 w-full rounded-xl border px-4"
        >
          <option>Launch speed</option>
          <option>Guest durability</option>
          <option>Premium design</option>
          <option>Budget certainty</option>
          <option>Maximum occupancy</option>
        </select>
      </label>
      <div
        className={`rounded-2xl border p-5 ${healthy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
      >
        <p className="text-xs font-bold uppercase tracking-[.15em]">
          Budget health
        </p>
        <p className="mt-2 font-serif text-2xl">
          {healthy ? "On track" : "Needs refinement"}
        </p>
        <p className="mt-2 text-xs leading-5 text-stone-600">
          Package estimate {money(estimated)}. Your design team will surface
          tradeoffs before approval.
        </p>
      </div>
    </div>
  );
}
function ReadyStage({
  property,
  pkg,
  rooms,
  budget,
  days,
}: {
  property: Row;
  pkg: Row;
  rooms: string[];
  budget: number;
  days: number;
}) {
  return (
    <div className="rounded-[2rem] border border-[#c9d9d1] bg-[#f1f7f4] p-7">
      <div className="flex gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#17483b] text-white">
          <CheckCircle2 className="size-6" />
        </span>
        <div>
          <h3 className="font-serif text-3xl">
            Let’s start designing your perfect space
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {String(property.name)} will begin with the {String(pkg.name)}{" "}
            package across {rooms.length} rooms.
          </p>
        </div>
      </div>
      <dl className="mt-7 grid gap-4 sm:grid-cols-3">
        <ReadyMetric label="Target budget" value={money(budget)} />
        <ReadyMetric label="Rooms" value={String(rooms.length)} />
        <ReadyMetric label="Installation" value={`${days} days`} />
      </dl>
      <p className="mt-6 rounded-xl bg-white p-4 text-xs leading-5 text-stone-500">
        Starting the project creates your room plan, budget, procurement
        tracker, installation checklist, and launch-readiness workspace.
      </p>
    </div>
  );
}
function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-[#edf3ef] text-[#17483b] [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-stone-400">
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
function ReadyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4">
      <dt className="text-[10px] font-bold uppercase tracking-[.15em] text-stone-400">
        {label}
      </dt>
      <dd className="mt-2 font-serif text-2xl">{value}</dd>
    </div>
  );
}
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
