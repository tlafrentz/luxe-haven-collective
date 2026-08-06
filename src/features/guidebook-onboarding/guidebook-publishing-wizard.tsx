"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LayoutTemplate,
  MapPin,
  Palette,
  Plus,
  Sparkles,
  Upload,
  Wifi,
} from "lucide-react";
type PropertyOption = Readonly<{
  id: string;
  name: string;
  location: string;
  image: string | null;
}>;

const steps = [
  { id: "property", label: "Property" },
  { id: "brand", label: "Brand" },
  { id: "template", label: "Template" },
  { id: "content", label: "Content" },
  { id: "media", label: "Media" },
  { id: "review", label: "Review" },
  { id: "publish", label: "Publish" },
  { id: "ready", label: "Ready" },
] as const;

const themes = [
  {
    name: "Luxury",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Beach",
    image:
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Cabin",
    image:
      "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Urban",
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267d?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Family",
    image:
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=700&q=80",
  },
  {
    name: "Minimal",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=700&q=80",
  },
] as const;

const templates = [
  {
    name: "Luxe Haven",
    tone: "A refined, image-led welcome",
    color: "#173f35",
    image: themes[0].image,
  },
  {
    name: "Coastal Escape",
    tone: "Airy, relaxed, and effortless",
    color: "#527d83",
    image: themes[1].image,
  },
  {
    name: "Modern Minimal",
    tone: "Clear, calm, and considered",
    color: "#665f58",
    image: themes[5].image,
  },
] as const;

const contentItems = [
  ["Check-in & check-out", "Arrival times and departure details"],
  ["Wi-Fi & internet", "Network name and guest access"],
  ["Parking instructions", "Where to arrive and park"],
  ["House rules", "The essentials for a comfortable stay"],
  ["Emergency contact", "Fast help when guests need it"],
  ["Amenities", "Everything included with the stay"],
] as const;

const mediaRooms = [
  "Exterior",
  "Living room",
  "Bedrooms",
  "Bathrooms",
  "Kitchen",
  "Amenities",
];

export function GuidebookPublishingWizard({
  workspaceId,
  properties,
  initialPropertyId,
  createAction,
}: Readonly<{
  workspaceId: string;
  properties: readonly PropertyOption[];
  initialPropertyId?: string;
  createAction: (formData: FormData) => Promise<void>;
}>) {
  const initialIndex = initialPropertyId ? 1 : 0;
  const [step, setStep] = useState(initialIndex);
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? "");
  const [theme, setTheme] = useState("Luxury");
  const [template, setTemplate] = useState("Luxe Haven");
  const [primaryColor, setPrimaryColor] = useState("#173f35");
  const [accentColor, setAccentColor] = useState("#c9a15a");
  const [voice, setVoice] = useState("Warm & welcoming");
  const [content, setContent] = useState(() =>
    Object.fromEntries(contentItems.map(([name]) => [name, true])),
  );
  const [media, setMedia] = useState<string[]>([
    "Exterior",
    "Living room",
    "Bedrooms",
  ]);

  const property =
    properties.find((item) => item.id === propertyId) ?? properties[0];
  const title = `${property?.name ?? "My Property"} Guest Guide`;
  const selectedTemplate =
    templates.find((item) => item.name === template) ?? templates[0];
  const progress = Math.round((step / (steps.length - 1)) * 100);
  const canContinue = step !== 0 || Boolean(propertyId);

  const previewItems = useMemo(
    () =>
      Object.entries(content)
        .filter(([, enabled]) => enabled)
        .slice(0, 4),
    [content],
  );

  return (
    <main className="min-h-screen bg-[#f6f1e8] text-[#1d211e]">
      <header className="border-b border-[#ded6c8] bg-[#fbf8f1]/95 px-5 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[94rem] items-center justify-between gap-5">
          <div>
            <Link
              href="/dashboard/guidebooks"
              className="text-xs font-semibold uppercase tracking-[.18em] text-[#766953]"
            >
              Guidebook Studio
            </Link>
            <h1 className="mt-1 font-serif text-2xl">
              Create a guest experience
            </h1>
          </div>
          <div className="hidden items-center gap-3 text-sm text-stone-600 sm:flex">
            <Clock3 className="size-4" /> About 10 minutes
          </div>
        </div>
      </header>

      <div className="border-b border-[#ded6c8] bg-white px-4">
        <nav
          aria-label="Guidebook creation progress"
          className="mx-auto max-w-[94rem] overflow-x-auto py-4"
        >
          <ol className="flex min-w-[760px] items-start justify-between">
            {steps.map((item, index) => (
              <li
                key={item.id}
                className="relative flex flex-1 flex-col items-center"
              >
                {index ? (
                  <span
                    className={`absolute right-1/2 top-3.5 h-px w-full ${index <= step ? "bg-[#275f50]" : "bg-stone-200"}`}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => index < step && setStep(index)}
                  className="relative z-10 flex flex-col items-center gap-2"
                  aria-current={index === step ? "step" : undefined}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full border text-xs font-semibold ${index < step ? "border-[#275f50] bg-[#275f50] text-white" : index === step ? "border-[#275f50] bg-white text-[#275f50] ring-4 ring-[#dfece6]" : "border-stone-300 bg-white text-stone-400"}`}
                  >
                    {index < step ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${index === step ? "text-[#173f35]" : "text-stone-500"}`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="mx-auto grid max-w-[94rem] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8 lg:py-12">
        <section className="min-w-0 rounded-[2rem] border border-[#ded6c8] bg-white p-6 shadow-[0_20px_60px_rgba(56,47,35,.08)] md:p-10">
          <StepHeader step={step} />
          <div className="mt-8">
            {step === 0 ? (
              <PropertyStep
                properties={properties}
                selected={propertyId}
                onSelect={setPropertyId}
              />
            ) : null}
            {step === 1 ? (
              <BrandStep
                theme={theme}
                onTheme={setTheme}
                primary={primaryColor}
                accent={accentColor}
                onPrimary={setPrimaryColor}
                onAccent={setAccentColor}
                voice={voice}
                onVoice={setVoice}
              />
            ) : null}
            {step === 2 ? (
              <TemplateStep
                selected={template}
                onSelect={(name, color) => {
                  setTemplate(name);
                  setPrimaryColor(color);
                }}
              />
            ) : null}
            {step === 3 ? (
              <ContentStep value={content} onChange={setContent} />
            ) : null}
            {step === 4 ? (
              <MediaStep selected={media} onChange={setMedia} />
            ) : null}
            {step === 5 ? (
              <ReviewStep
                property={property}
                theme={theme}
                template={template}
                contentCount={previewItems.length}
                mediaCount={media.length}
              />
            ) : null}
            {step === 6 ? <PublishStep /> : null}
            {step === 7 ? (
              <ReadyStep propertyName={property?.name ?? "your property"} />
            ) : null}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
            <button
              type="button"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-stone-600 disabled:invisible"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
            {step < 7 ? (
              <button
                type="button"
                onClick={() => setStep((value) => Math.min(7, value + 1))}
                disabled={!canContinue}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173f35] px-6 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === 6 ? "Prepare guidebook" : "Save & continue"}{" "}
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <form action={createAction}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input
                  type="hidden"
                  name="propertyId"
                  value={propertyId || property.id}
                />
                <input type="hidden" name="title" value={title} />
                <input
                  type="hidden"
                  name="commandId"
                  value={`guidebook-onboarding:${propertyId || property.id}`}
                />
                <button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#173f35] px-7 text-sm font-semibold text-white shadow-sm">
                  Open my guidebook <Sparkles className="size-4" />
                </button>
              </form>
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <GuidebookPreview
            property={property}
            image={selectedTemplate.image}
            title={title}
            color={primaryColor}
            accent={accentColor}
            items={previewItems.map(([name]) => name)}
          />
          <div className="mt-4 rounded-2xl border border-[#ded6c8] bg-white p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[.14em] text-stone-500">
              <span>Your progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-[#275f50] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-500">
              Every choice shapes what guests will see. You can refine
              everything in the Studio before publishing.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function StepHeader({ step }: { step: number }) {
  const copy = [
    ["Choose your property", "Which stay are we creating a guidebook for?"],
    [
      "Let’s match your style",
      "Give the experience a visual voice that feels like your property.",
    ],
    [
      "Choose a beautiful starting point",
      "Select a cover and layout. You can refine every detail later.",
    ],
    [
      "Add the essentials",
      "Collect the guest-facing information people need during their stay.",
    ],
    [
      "Bring the property to life",
      "Add imagery that helps guests recognize spaces and feel at home.",
    ],
    [
      "Your guidebook is taking shape",
      "Review the experience across the choices you’ve made.",
    ],
    [
      "Ready to prepare your guidebook?",
      "We’ll create the editorial workspace and starter content for this property.",
    ],
    [
      "Your creative workspace is ready",
      "Continue in Guidebook Studio to refine, preview, and publish.",
    ],
  ][step];
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a7440]">
        Step {step + 1} of 8
      </p>
      <h2 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
        {copy[0]}
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
        {copy[1]}
      </p>
    </header>
  );
}

function PropertyStep({
  properties,
  selected,
  onSelect,
}: {
  properties: readonly PropertyOption[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {properties.map((property, index) => (
        <button
          key={property.id}
          type="button"
          onClick={() => onSelect(property.id)}
          className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-1 hover:shadow-lg ${selected === property.id ? "border-[#275f50] ring-2 ring-[#b9d3c8]" : "border-stone-200"}`}
        >
          <div className="relative aspect-[4/3] bg-[#e9e1d4]">
            {property.image ? (
              <Image
                src={property.image}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <Image
                src={themes[index % themes.length].image}
                alt=""
                fill
                className="object-cover"
              />
            )}
            {selected === property.id ? (
              <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-[#173f35] text-white">
                <Check className="size-4" />
              </span>
            ) : null}
          </div>
          <div className="p-4">
            <h3 className="font-serif text-xl">{property.name}</h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
              <MapPin className="size-3" />
              {property.location || "Your property"}
            </p>
          </div>
        </button>
      ))}
      <button
        type="button"
        className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-center text-stone-500"
      >
        <span>
          <Plus className="mx-auto size-6" />
          <span className="mt-2 block text-sm font-semibold">
            Add a new property
          </span>
        </span>
      </button>
    </div>
  );
}

function BrandStep({
  theme,
  onTheme,
  primary,
  accent,
  onPrimary,
  onAccent,
  voice,
  onVoice,
}: {
  theme: string;
  onTheme: (value: string) => void;
  primary: string;
  accent: string;
  onPrimary: (value: string) => void;
  onAccent: (value: string) => void;
  voice: string;
  onVoice: (value: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {themes.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onTheme(item.name)}
            className={`group overflow-hidden rounded-2xl border text-left ${theme === item.name ? "border-[#275f50] ring-2 ring-[#b9d3c8]" : "border-stone-200"}`}
          >
            <div className="relative aspect-[5/3]">
              <Image
                src={item.image}
                alt=""
                fill
                className="object-cover transition group-hover:scale-105"
              />
            </div>
            <span className="flex items-center justify-between p-3 text-sm font-semibold">
              {item.name}
              {theme === item.name ? (
                <Check className="size-4 text-[#275f50]" />
              ) : null}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-5 rounded-2xl bg-[#f7f4ed] p-5 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Primary color
          <span className="mt-2 flex items-center gap-2 rounded-xl border bg-white p-2">
            <input
              type="color"
              value={primary}
              onChange={(event) => onPrimary(event.target.value)}
              className="size-8 rounded border-0"
            />
            <span className="font-mono text-xs uppercase">{primary}</span>
          </span>
        </label>
        <label className="text-sm font-semibold">
          Accent color
          <span className="mt-2 flex items-center gap-2 rounded-xl border bg-white p-2">
            <input
              type="color"
              value={accent}
              onChange={(event) => onAccent(event.target.value)}
              className="size-8 rounded border-0"
            />
            <span className="font-mono text-xs uppercase">{accent}</span>
          </span>
        </label>
        <label className="text-sm font-semibold">
          Brand voice
          <select
            value={voice}
            onChange={(event) => onVoice(event.target.value)}
            className="mt-2 block h-12 w-full rounded-xl border bg-white px-3 text-sm font-normal"
          >
            <option>Warm & welcoming</option>
            <option>Professional</option>
            <option>Luxury</option>
            <option>Playful</option>
            <option>Minimal</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function TemplateStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (name: string, color: string) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {templates.map((item) => (
        <button
          key={item.name}
          type="button"
          onClick={() => onSelect(item.name, item.color)}
          className={`overflow-hidden rounded-[1.5rem] border bg-white text-left transition hover:-translate-y-1 hover:shadow-xl ${selected === item.name ? "border-[#275f50] ring-2 ring-[#b9d3c8]" : "border-stone-200"}`}
        >
          <div className="relative aspect-[3/4]">
            <Image src={item.image} alt="" fill className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 pt-16 text-white">
              <p className="text-[10px] uppercase tracking-[.2em]">
                Welcome to
              </p>
              <p className="mt-2 font-serif text-3xl">Your stay</p>
            </div>
            {selected === item.name ? (
              <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white text-[#173f35]">
                <Check className="size-4" />
              </span>
            ) : null}
          </div>
          <div className="p-4">
            <h3 className="font-serif text-xl">{item.name}</h3>
            <p className="mt-1 text-xs leading-5 text-stone-500">{item.tone}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function ContentStep({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (value: Record<string, boolean>) => void;
}) {
  return (
    <div className="divide-y rounded-2xl border">
      {contentItems.map(([name, description], index) => (
        <div key={name} className="flex items-center gap-4 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf4f0] text-[#275f50]">
            {index === 1 ? (
              <Wifi className="size-4" />
            ) : (
              <span className="text-xs font-bold">{index + 1}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{name}</h3>
            <p className="mt-1 text-xs text-stone-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...value, [name]: !value[name] })}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${value[name] ? "bg-[#173f35] text-white" : "border text-stone-500"}`}
          >
            {value[name] ? "Included" : "Add"}
          </button>
        </div>
      ))}
    </div>
  );
}

function MediaStep({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div>
      <div className="rounded-2xl border-2 border-dashed border-[#cfc3b2] bg-[#faf7f1] p-8 text-center">
        <Upload className="mx-auto size-7 text-[#8b714c]" />
        <h3 className="mt-3 font-serif text-2xl">
          Drop beautiful property photos here
        </h3>
        <p className="mt-2 text-sm text-stone-500">
          JPG, PNG, or WebP · up to 10 MB each
        </p>
        <button
          type="button"
          className="mt-5 rounded-full border bg-white px-5 py-2.5 text-sm font-semibold"
        >
          Choose photos
        </button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mediaRooms.map((room, index) => {
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
              className={`relative aspect-[4/3] overflow-hidden rounded-xl border ${active ? "border-[#275f50] ring-2 ring-[#b9d3c8]" : "bg-stone-50"}`}
            >
              {active ? (
                <Image
                  src={themes[index % themes.length].image}
                  alt=""
                  fill
                  className="object-cover"
                />
              ) : (
                <ImagePlus className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-stone-300" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-left text-xs font-semibold text-white">
                {room}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewStep({
  property,
  theme,
  template,
  contentCount,
  mediaCount,
}: {
  property: PropertyOption;
  theme: string;
  template: string;
  contentCount: number;
  mediaCount: number;
}) {
  const rows = [
    ["Property", property.name],
    ["Visual style", theme],
    ["Template", template],
    ["Guest sections", `${contentCount} essentials ready`],
    ["Media", `${mediaCount} spaces represented`],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={`rounded-2xl border p-5 ${index === 0 ? "sm:col-span-2" : ""}`}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8f1ed] text-[#275f50]">
              <Check className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.15em] text-stone-400">
                {label}
              </p>
              <p className="mt-1 font-serif text-xl">{value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PublishStep() {
  return (
    <div className="rounded-[2rem] border border-[#c9d9d1] bg-[#f1f7f4] p-7">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-[#173f35] text-white">
          <CheckCircle2 className="size-6" />
        </span>
        <div>
          <h3 className="font-serif text-2xl">
            Everything is ready for your Studio
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Your starter guide will include the guest essentials and visual
            direction you selected.
          </p>
        </div>
      </div>
      <ul className="mt-7 grid gap-3 sm:grid-cols-2">
        {[
          "Property connected",
          "Brand direction chosen",
          "Template selected",
          "Guest essentials outlined",
          "Media plan started",
          "Preview reviewed",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-[#275f50]" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-6 rounded-xl bg-white p-4 text-xs leading-5 text-stone-500">
        Your guidebook remains a private draft until you review its final
        content and explicitly publish from Guidebook Studio. Guests never see
        unfinished work.
      </p>
    </div>
  );
}

function ReadyStep({ propertyName }: { propertyName: string }) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#173f35] text-white shadow-xl">
        <Sparkles className="size-9" />
      </span>
      <h3 className="mt-6 font-serif text-4xl">Welcome to Guidebook Studio</h3>
      <p className="mx-auto mt-4 max-w-xl leading-7 text-stone-600">
        Your creative direction for {propertyName} is ready. Open the guidebook
        to refine guest details, preview every device, and publish when it feels
        exceptional.
      </p>
    </div>
  );
}

function GuidebookPreview({
  property,
  image,
  title,
  color,
  accent,
  items,
}: {
  property: PropertyOption;
  image: string;
  title: string;
  color: string;
  accent: string;
  items: string[];
}) {
  return (
    <div className="rounded-[2rem] border border-[#d8cfbf] bg-[#e8dfd1] p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-stone-500">
            Live preview
          </p>
          <p className="mt-1 text-sm font-semibold">Guest mobile experience</p>
        </div>
        <Palette className="size-4 text-stone-500" />
      </div>
      <div className="mx-auto w-[250px] overflow-hidden rounded-[2rem] border-[6px] border-[#252724] bg-white shadow-2xl">
        <div className="relative h-72">
          <Image
            src={property.image || image}
            alt=""
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <p
              className="text-[9px] uppercase tracking-[.2em]"
              style={{ color: accent }}
            >
              Welcome to
            </p>
            <h3 className="mt-2 font-serif text-3xl leading-none">
              {property.name}
            </h3>
            <p className="mt-2 text-[10px] text-white/75">
              Everything you need for an exceptional stay.
            </p>
          </div>
        </div>
        <div
          className="space-y-2 p-3"
          style={{ backgroundColor: `${color}0d` }}
        >
          {items.length ? (
            items.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
              >
                <span
                  className="grid size-7 place-items-center rounded-lg text-white"
                  style={{ backgroundColor: color }}
                >
                  {index === 1 ? (
                    <Wifi className="size-3" />
                  ) : (
                    <LayoutTemplate className="size-3" />
                  )}
                </span>
                <span className="text-[10px] font-semibold">{item}</span>
                <ArrowRight className="ml-auto size-3 text-stone-300" />
              </div>
            ))
          ) : (
            <p className="p-5 text-center text-xs text-stone-400">
              Your guest sections will appear here.
            </p>
          )}
        </div>
      </div>
      <p className="mt-4 truncate text-center text-xs font-medium text-stone-600">
        {title}
      </p>
    </div>
  );
}
