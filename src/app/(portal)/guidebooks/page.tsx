"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Coffee,
  Eye,
  FileDown,
  House,
  Image as ImageIcon,
  MapPin,
  Palette,
  ParkingCircle,
  Plus,
  QrCode,
  Rocket,
  Settings2,
  Sparkles,
  Star,
  Utensils,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { WorkspaceContent, WorkspaceHeader, WorkspacePage } from "@/components/application-layout";

type StudioView = "overview" | "journey" | "content" | "recommendations" | "brand" | "publish";
type JourneyId = "before-arrival" | "arrival" | "during-stay" | "departure" | "after-stay";

const navigation: readonly Readonly<{ id: StudioView; label: string; icon: LucideIcon }>[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "journey", label: "Guest Journey", icon: Sparkles },
  { id: "content", label: "Content", icon: Settings2 },
  { id: "recommendations", label: "Recommendations", icon: MapPin },
  { id: "brand", label: "Brand", icon: Palette },
  { id: "publish", label: "Publish", icon: Rocket },
];

const stages: readonly Readonly<{
  id: JourneyId;
  label: string;
  guestNeed: string;
  status: "complete" | "attention";
  items: readonly Readonly<{ title: string; description: string; icon: LucideIcon; complete: boolean }>[];
}>[] = [
  {
    id: "before-arrival",
    label: "Before Arrival",
    guestNeed: "Help me feel prepared and confident about my trip.",
    status: "complete",
    items: [
      { title: "Welcome", description: "Set expectations and build anticipation.", icon: Star, complete: true },
      { title: "Getting here", description: "Address, directions, and transportation.", icon: MapPin, complete: true },
      { title: "Parking", description: "Where to park and what to expect.", icon: ParkingCircle, complete: true },
    ],
  },
  {
    id: "arrival",
    label: "Arrival",
    guestNeed: "Help me get inside and settled without friction.",
    status: "complete",
    items: [
      { title: "Check-in", description: "Arrival window and entry instructions.", icon: House, complete: true },
      { title: "Wi-Fi", description: "Network access available immediately.", icon: Wifi, complete: true },
      { title: "First moments", description: "Lighting, temperature, and essentials.", icon: Sparkles, complete: true },
    ],
  },
  {
    id: "during-stay",
    label: "During Stay",
    guestNeed: "Help me feel at home and enjoy the destination.",
    status: "attention",
    items: [
      { title: "Living well", description: "Appliances, thermostat, laundry, and amenities.", icon: Settings2, complete: true },
      { title: "Coffee & kitchen", description: "How to enjoy the home's kitchen.", icon: Coffee, complete: true },
      { title: "Emergency help", description: "Contacts and what to do when something goes wrong.", icon: CircleAlert, complete: false },
    ],
  },
  {
    id: "departure",
    label: "Departure",
    guestNeed: "Make checkout simple and unambiguous.",
    status: "attention",
    items: [
      { title: "Checkout", description: "Time, steps, and final lock-up.", icon: Check, complete: true },
      { title: "Trash & dishes", description: "Reasonable guest expectations.", icon: Settings2, complete: false },
    ],
  },
  {
    id: "after-stay",
    label: "After Stay",
    guestNeed: "Close the stay thoughtfully and help me return.",
    status: "attention",
    items: [
      { title: "Thank you", description: "A warm close to the guest relationship.", icon: Star, complete: true },
      { title: "Stay connected", description: "Review, return, and direct-booking guidance.", icon: ArrowRight, complete: false },
    ],
  },
];

export default function GuidebookStudioPage() {
  const [view, setView] = useState<StudioView>("overview");
  const [stageId, setStageId] = useState<JourneyId>("during-stay");
  const [previewMode, setPreviewMode] = useState(false);
  const stage = stages.find((item) => item.id === stageId) ?? stages[0];

  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader
        eyebrow="Services · Guest experience"
        title="Guidebook Studio"
        description="Design the experience that helps every guest arrive informed, comfortable, and excited."
        actions={
        <div className="flex gap-2">
          <button type="button" onClick={() => setPreviewMode(!previewMode)} className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-teal-600"><Eye aria-hidden="true" className="h-4 w-4" />{previewMode ? "Exit preview" : "Guest preview"}</button>
          <button type="button" onClick={() => setView("publish")} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white outline-none hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"><Rocket aria-hidden="true" className="h-4 w-4" />Publish</button>
        </div>
        }
      />

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-stone-50">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-900">MD</span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-stone-950">Mesa Downtown Retreat</span><span className="block text-xs text-stone-500">Primary guidebook · Published</span></span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 text-stone-400" />
        </button>
        <div className="flex items-center gap-2 px-2 text-xs text-stone-500"><span className="h-2 w-2 rounded-full bg-teal-600" />Guest website live · Updated yesterday</div>
      </div>

      <nav aria-label="Guidebook Studio sections" className="mt-6 overflow-x-auto border-b border-stone-200">
        <div className="flex min-w-max gap-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return <button key={item.id} type="button" onClick={() => setView(item.id)} className={["flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600", active ? "border-teal-700 text-teal-800" : "border-transparent text-stone-500 hover:text-stone-900"].join(" ")} aria-current={active ? "page" : undefined}><Icon aria-hidden="true" className="h-4 w-4" />{item.label}</button>;
          })}
        </div>
      </nav>

      <WorkspaceContent>
      {previewMode ? <GuestPreview onClose={() => setPreviewMode(false)} /> :
        view === "overview" ? <Overview setView={setView} setStageId={setStageId} /> :
        view === "journey" ? <GuestJourney stage={stage} stageId={stageId} setStageId={setStageId} /> :
        view === "content" ? <ContentLibrary /> :
        view === "recommendations" ? <Recommendations /> :
        view === "brand" ? <Brand /> :
        <Publish />}
      </WorkspaceContent>
    </WorkspacePage>
  );
}

function Overview({ setView, setStageId }: Readonly<{ setView: (view: StudioView) => void; setStageId: (stage: JourneyId) => void }>) {
  return (
    <div className="mt-7">
      <section aria-labelledby="health-heading" className="overflow-hidden rounded-3xl border border-stone-200 bg-stone-950 text-white shadow-sm">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Guidebook health</p>
            <div className="mt-4 flex items-end gap-3"><span className="text-5xl font-semibold tracking-tight">92%</span><span className="mb-1.5 text-sm text-stone-400">complete</span></div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[92%] rounded-full bg-amber-200" /></div>
            <p className="mt-5 max-w-sm text-sm leading-6 text-stone-300">Your guidebook is published and ready for guests. Complete two missing experiences to make the journey exceptional end to end.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <HealthMetric label="Status" value="Published" icon={Check} positive />
            <HealthMetric label="Missing" value="2 sections" icon={CircleAlert} attention />
            <HealthMetric label="Guest views" value="184" icon={Eye} />
            <HealthMetric label="QR code" value="Active" icon={QrCode} positive />
          </div>
        </div>
      </section>

      <section aria-labelledby="journey-heading" className="mt-9">
        <div className="flex items-end justify-between gap-4"><div><h2 id="journey-heading" className="text-xl font-semibold text-stone-950">Guest journey</h2><p className="mt-1 text-sm text-stone-600">Prepare guests for what they need next—not for a sequence of pages.</p></div><button type="button" onClick={() => setView("journey")} className="hidden text-sm font-semibold text-stone-600 hover:text-stone-950 sm:inline-flex">Design journey</button></div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {stages.map((stage, index) => <button key={stage.id} type="button" onClick={() => { setStageId(stage.id); setView("journey"); }} className="group rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm outline-none hover:border-stone-300 focus-visible:ring-2 focus-visible:ring-teal-600"><div className="flex items-center justify-between"><span className={["flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", stage.status === "complete" ? "bg-teal-700 text-white" : "bg-amber-100 text-amber-800"].join(" ")}>{stage.status === "complete" ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}</span><ChevronRight aria-hidden="true" className="h-4 w-4 text-stone-300 group-hover:text-stone-600" /></div><h3 className="mt-5 text-sm font-semibold text-stone-950">{stage.label}</h3><p className="mt-1 text-xs text-stone-500">{stage.items.filter((item) => item.complete).length} of {stage.items.length} experiences ready</p></button>)}
        </div>
      </section>

      <section className="mt-9 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="text-xl font-semibold text-stone-950">Needs attention</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            <AttentionRow title="Add emergency help" description="During Stay · Give guests a clear path when something goes wrong." action="Add content" onClick={() => { setStageId("during-stay"); setView("journey"); }} />
            <AttentionRow title="Clarify trash and dishes" description="Departure · Reduce checkout uncertainty with reasonable expectations." action="Complete section" onClick={() => { setStageId("departure"); setView("journey"); }} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-stone-950">Recent updates</h2>
          <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"><Activity label="Parking instructions updated" time="Yesterday" /><Activity label="Restaurant recommendation added" time="3 days ago" /><Activity label="Guidebook version 4 published" time="Jul 18" /></div>
        </div>
      </section>
    </div>
  );
}

function HealthMetric({ label, value, icon: Icon, positive, attention }: Readonly<{ label: string; value: string; icon: LucideIcon; positive?: boolean; attention?: boolean }>) {
  return <div className="min-h-32 border-b border-r border-white/10 p-5"><span className={["flex h-7 w-7 items-center justify-center rounded-full", positive ? "bg-teal-300/15 text-teal-200" : attention ? "bg-amber-200/15 text-amber-200" : "bg-white/10 text-stone-300"].join(" ")}><Icon aria-hidden="true" className="h-3.5 w-3.5" /></span><p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div>;
}

function AttentionRow({ title, description, action, onClick }: Readonly<{ title: string; description: string; action: string; onClick: () => void }>) {
  return <div className="flex flex-col justify-between gap-4 border-b border-stone-200 p-5 last:border-b-0 sm:flex-row sm:items-center"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><CircleAlert aria-hidden="true" className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-stone-950">{title}</h3><p className="mt-1 text-xs leading-5 text-stone-500">{description}</p></div></div><button type="button" onClick={onClick} className="self-start rounded-full border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50">{action}</button></div>;
}

function Activity({ label, time }: Readonly<{ label: string; time: string }>) {
  return <div className="flex gap-3 border-b border-stone-100 py-3 first:pt-0 last:border-b-0 last:pb-0"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-600" /><div className="flex-1"><p className="text-xs font-medium text-stone-700">{label}</p><p className="mt-1 text-[10px] text-stone-400">{time}</p></div></div>;
}

function GuestJourney({ stage, stageId, setStageId }: Readonly<{ stage: (typeof stages)[number]; stageId: JourneyId; setStageId: (id: JourneyId) => void }>) {
  return <div className="mt-7 grid gap-6 lg:grid-cols-[260px_1fr]"><aside><p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Journey stages</p><div className="mt-3 space-y-1">{stages.map((item, index) => <button key={item.id} type="button" onClick={() => setStageId(item.id)} className={["flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600", stageId === item.id ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100"].join(" ")}><span className={["flex h-6 w-6 items-center justify-center rounded-full text-[10px]", item.status === "complete" ? "bg-teal-700 text-white" : stageId === item.id ? "bg-amber-200 text-amber-950" : "bg-amber-100 text-amber-800"].join(" ")}>{item.status === "complete" ? <Check className="h-3 w-3" /> : index + 1}</span>{item.label}</button>)}</div></aside><section><p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">What does the guest need now?</p><h2 className="mt-2 text-2xl font-semibold text-stone-950">{stage.label}</h2><p className="mt-2 text-base text-stone-600">“{stage.guestNeed}”</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{stage.items.map((item) => <ExperienceCard key={item.title} {...item} />)}<button type="button" className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-center text-stone-500 outline-none hover:border-teal-500 hover:text-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600"><Plus className="h-5 w-5" /><span className="mt-2 text-sm font-semibold">Add guest experience</span><span className="mt-1 text-xs">What else would reduce friction?</span></button></div></section></div>;
}

function ExperienceCard({ title, description, icon: Icon, complete }: Readonly<{ title: string; description: string; icon: LucideIcon; complete: boolean }>) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700"><Icon aria-hidden="true" className="h-5 w-5" /></span><span className={["rounded-full px-2.5 py-1 text-[10px] font-semibold", complete ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"].join(" ")}>{complete ? "Ready" : "Missing"}</span></div><h3 className="mt-5 text-sm font-semibold text-stone-950">{title}</h3><p className="mt-2 text-xs leading-5 text-stone-500">{description}</p><button type="button" className="mt-5 text-xs font-semibold text-stone-700 hover:text-teal-800">{complete ? "Review experience" : "Add content"} →</button></article>;
}

function ContentLibrary() {
  const items = [{ title: "Parking", category: "Arrival", icon: ParkingCircle }, { title: "Wi-Fi", category: "Arrival", icon: Wifi }, { title: "Coffee & kitchen", category: "During Stay", icon: Coffee }, { title: "House essentials", category: "During Stay", icon: House }, { title: "Photography", category: "Across journey", icon: ImageIcon }];
  return <section className="mt-7"><div className="flex items-end justify-between"><div><h2 className="text-2xl font-semibold text-stone-950">Hospitality content</h2><p className="mt-2 text-sm text-stone-600">Manage the information guests need across their stay.</p></div><button type="button" className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add content</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><item.icon className="h-5 w-5 text-stone-500" /><p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{item.category}</p><h3 className="mt-1 font-semibold text-stone-950">{item.title}</h3><button className="mt-5 text-xs font-semibold text-stone-600">Manage content →</button></article>)}</div></section>;
}

function Recommendations() {
  return <section className="mt-7"><h2 className="text-2xl font-semibold text-stone-950">Local experiences</h2><p className="mt-2 text-sm text-stone-600">Curate what guests should enjoy nearby—not an unfiltered directory.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><RecommendationCard icon={Utensils} title="Restaurants" count="8 curated" /><RecommendationCard icon={Coffee} title="Coffee" count="4 curated" /><RecommendationCard icon={MapPin} title="Activities" count="6 curated" /></div></section>;
}

function RecommendationCard({ icon: Icon, title, count }: Readonly<{ icon: LucideIcon; title: string; count: string }>) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-900"><Icon className="h-5 w-5" /></span><h3 className="mt-5 font-semibold text-stone-950">{title}</h3><p className="mt-1 text-xs text-stone-500">{count}</p><button type="button" className="mt-6 text-xs font-semibold text-stone-700">Curate recommendations →</button></article>;
}

function Brand() {
  return <section className="mt-7 grid gap-6 lg:grid-cols-[1fr_0.8fr]"><div><h2 className="text-2xl font-semibold text-stone-950">Guidebook brand</h2><p className="mt-2 text-sm text-stone-600">Make the guest experience feel unmistakably yours.</p><div className="mt-6 space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"><BrandRow label="Logo" value="Luxe Haven Collective" /><BrandRow label="Colors" value="Warm sand · Deep charcoal" /><BrandRow label="Typography" value="Editorial serif · Modern sans" /><BrandRow label="Voice" value="Warm, polished, reassuring" /></div></div><div className="rounded-3xl bg-[#1d1a17] p-7 text-white"><p className="font-serif text-3xl">Welcome home.</p><p className="mt-4 text-sm leading-6 text-stone-300">Everything you need for an effortless stay at Mesa Downtown Retreat.</p><span className="mt-8 inline-flex rounded-full bg-[#d7b77d] px-4 py-2 text-xs font-semibold text-stone-950">Begin your stay</span></div></section>;
}

function BrandRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return <button type="button" className="flex w-full items-center justify-between border-b border-stone-100 pb-4 text-left last:border-b-0 last:pb-0"><span><span className="block text-xs font-semibold text-stone-500">{label}</span><span className="mt-1 block text-sm font-medium text-stone-900">{value}</span></span><ChevronRight className="h-4 w-4 text-stone-400" /></button>;
}

function Publish() {
  return <section className="mt-7"><h2 className="text-2xl font-semibold text-stone-950">Publish guest experience</h2><p className="mt-2 text-sm text-stone-600">Review each output before delivering the guidebook to guests.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><OutputCard icon={Eye} title="Guest website" description="Responsive, mobile-first guidebook" status="Live" active /><OutputCard icon={QrCode} title="QR code" description="Place inside the property" status="Active" active /><OutputCard icon={FileDown} title="Printable PDF" description="Portable secondary format" status="Ready" /></div><div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Two guest experiences are incomplete.</p><p className="mt-1 text-xs leading-5 text-amber-800">Publishing is disabled until content persistence and version services are connected. AI will never publish without your explicit approval.</p></div></div><button type="button" disabled className="mt-6 cursor-not-allowed rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white opacity-40">Publish new version</button></section>;
}

function OutputCard({ icon: Icon, title, description, status, active }: Readonly<{ icon: LucideIcon; title: string; description: string; status: string; active?: boolean }>) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700"><Icon className="h-5 w-5" /></span><span className={["rounded-full px-2.5 py-1 text-[10px] font-semibold", active ? "bg-teal-50 text-teal-800" : "bg-stone-100 text-stone-600"].join(" ")}>{status}</span></div><h3 className="mt-5 text-sm font-semibold text-stone-950">{title}</h3><p className="mt-1 text-xs text-stone-500">{description}</p></article>;
}

function GuestPreview({ onClose }: Readonly<{ onClose: () => void }>) {
  return <section className="mt-7 overflow-hidden rounded-3xl border border-stone-200 bg-[#eee5d7] p-4 sm:p-8"><div className="mx-auto max-w-sm overflow-hidden rounded-[2rem] border-8 border-stone-900 bg-[#fbf8f1] shadow-2xl"><div className="bg-[#1d1a17] px-6 pb-9 pt-10 text-white"><p className="text-xs uppercase tracking-[0.2em] text-[#d7b77d]">Mesa Downtown Retreat</p><h2 className="mt-4 font-serif text-4xl leading-tight">Welcome home.</h2><p className="mt-3 text-sm leading-6 text-stone-300">Everything you need for an effortless stay.</p></div><div className="space-y-3 p-5">{["Before you arrive", "Getting inside", "Enjoy your stay", "Explore Mesa", "Checkout"].map((label, index) => <button key={label} className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eee5d7] text-xs font-semibold">{index + 1}</span><span className="flex-1 text-sm font-semibold text-stone-800">{label}</span><ChevronRight className="h-4 w-4 text-stone-400" /></button>)}</div></div><div className="mt-6 text-center"><button type="button" onClick={onClose} className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">Return to Studio</button></div></section>;
}
