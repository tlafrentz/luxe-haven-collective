"use client";

import {
  Archive,
  BellRing,
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  House,
  Inbox,
  Languages,
  MessageCircleMore,
  Search,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { WorkspaceContent, WorkspaceHeader, WorkspaceOverview, WorkspacePage } from "@/components/application-layout";

type ViewId = "inbox" | "attention" | "scheduled" | "templates" | "search" | "archive";
type ConversationStatus = "Open" | "Waiting for Guest" | "Waiting for Host" | "Scheduled" | "Closed" | "Archived";
type JourneyStage = "Inquiry" | "Before arrival" | "Arrival" | "Stay" | "Departure" | "After stay";

type Conversation = Readonly<{
  id: string;
  guest: string;
  initials: string;
  property: string;
  reservation: string;
  stage: JourneyStage;
  status: ConversationStatus;
  source: "Airbnb" | "SMS" | "Booking.com" | "Direct";
  preview: string;
  time: string;
  attention?: "Urgent" | "Needs reply";
  sentiment?: "Concerned";
  archived?: boolean;
  scheduled?: boolean;
  messages: readonly Readonly<{ from: "guest" | "host"; body: string; time: string; source: string }>[];
}>;

const conversations: readonly Conversation[] = [
  {
    id: "maya",
    guest: "Maya Chen",
    initials: "MC",
    property: "Mesa Downtown Retreat",
    reservation: "Jul 24–28 · 4 guests",
    stage: "Arrival",
    status: "Waiting for Host",
    source: "Airbnb",
    preview: "We’ve arrived, but the keypad isn’t accepting the code.",
    time: "8 min",
    attention: "Urgent",
    sentiment: "Concerned",
    messages: [
      { from: "host", body: "Hi Maya! Your check-in code is 4821. It becomes active at 4:00 PM today.", time: "3:42 PM", source: "Airbnb" },
      { from: "guest", body: "Thanks! We’ve arrived, but the keypad isn’t accepting the code. Are we missing a step?", time: "4:08 PM", source: "Airbnb" },
    ],
  },
  {
    id: "jonah",
    guest: "Jonah Williams",
    initials: "JW",
    property: "Urban Haven Suite",
    reservation: "Jul 25–27 · 2 guests",
    stage: "Before arrival",
    status: "Waiting for Host",
    source: "SMS",
    preview: "Is early check-in around 1 PM possible tomorrow?",
    time: "26 min",
    attention: "Needs reply",
    messages: [
      { from: "guest", body: "Hi! Is early check-in around 1 PM possible tomorrow? Our flight arrives before noon.", time: "3:50 PM", source: "SMS" },
    ],
  },
  {
    id: "elena",
    guest: "Elena García",
    initials: "EG",
    property: "Desert Modern House",
    reservation: "Jul 21–25 · 3 guests",
    stage: "Departure",
    status: "Waiting for Guest",
    source: "Booking.com",
    preview: "Checkout instructions sent. Let us know if you need anything.",
    time: "1 hr",
    messages: [
      { from: "host", body: "We hope you enjoyed your stay. Checkout is at 11 AM; please lock the door behind you.", time: "3:12 PM", source: "Booking.com" },
    ],
  },
  {
    id: "noah",
    guest: "Noah Thompson",
    initials: "NT",
    property: "Mesa Downtown Retreat",
    reservation: "Aug 2–6 · 2 guests",
    stage: "Inquiry",
    status: "Open",
    source: "Direct",
    preview: "Does the home have a dedicated workspace and reliable Wi-Fi?",
    time: "2 hr",
    messages: [
      { from: "guest", body: "Does the home have a dedicated workspace and reliable Wi-Fi? I’ll be working remotely.", time: "2:18 PM", source: "Email" },
    ],
  },
  {
    id: "aisha",
    guest: "Aisha Patel",
    initials: "AP",
    property: "Urban Haven Suite",
    reservation: "Jul 30–Aug 3 · 2 guests",
    stage: "Before arrival",
    status: "Scheduled",
    source: "Airbnb",
    preview: "Welcome and arrival guide scheduled for Jul 29.",
    time: "Jul 29",
    scheduled: true,
    messages: [],
  },
  {
    id: "liam",
    guest: "Liam Brown",
    initials: "LB",
    property: "Desert Modern House",
    reservation: "Jun 10–14 · 4 guests",
    stage: "After stay",
    status: "Archived",
    source: "Airbnb",
    preview: "Thanks again—we had an excellent stay!",
    time: "Jun 15",
    archived: true,
    messages: [
      { from: "guest", body: "Thanks again—we had an excellent stay!", time: "Jun 15", source: "Airbnb" },
    ],
  },
];

const views: readonly Readonly<{ id: ViewId; label: string; icon: typeof Inbox; count?: number }>[] = [
  { id: "inbox", label: "Inbox", icon: Inbox, count: 4 },
  { id: "attention", label: "Needs attention", icon: BellRing, count: 2 },
  { id: "scheduled", label: "Scheduled", icon: CalendarClock, count: 5 },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "search", label: "Search", icon: Search },
  { id: "archive", label: "Archive", icon: Archive },
];

export default function GuestCommunicationsPage() {
  const [view, setView] = useState<ViewId>("attention");
  const [selectedId, setSelectedId] = useState("maya");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");

  const visible = useMemo(() => conversations.filter((conversation) => {
    if (view === "attention" && !conversation.attention) return false;
    if (view === "scheduled" && !conversation.scheduled) return false;
    if (view === "archive" && !conversation.archived) return false;
    if (view === "inbox" && (conversation.archived || conversation.scheduled)) return false;
    if (view === "templates") return false;
    const term = query.trim().toLowerCase();
    return !term || [conversation.guest, conversation.property, conversation.reservation, conversation.preview].some((value) => value.toLowerCase().includes(term));
  }), [query, view]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? visible[0];

  const chooseView = (next: ViewId) => {
    setView(next);
    setQuery("");
    const first = conversations.find((conversation) =>
      next === "attention" ? conversation.attention :
      next === "scheduled" ? conversation.scheduled :
      next === "archive" ? conversation.archived :
      !conversation.archived && !conversation.scheduled,
    );
    if (first) setSelectedId(first.id);
  };

  return (
    <WorkspacePage width="wide">
      <WorkspaceHeader
        eyebrow="Business · Guest journey"
        title="Guest Communications"
        description="See which guests need attention and respond with context across every channel."
        context={<span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800">Preview</span>}
        actions={
        <button type="button" disabled title="Requires a guest messaging provider" className="inline-flex cursor-not-allowed items-center justify-center gap-2 self-start rounded-full bg-stone-300 px-5 py-2.5 text-sm font-semibold text-white">
          <MessageCircleMore aria-hidden="true" className="h-4 w-4" />
          New conversation · Preview
        </button>
        }
      />
      <WorkspaceContent>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-950">
          <p className="font-semibold">Preview — guest messaging is not connected</p>
          <p className="mt-1">All conversations and counts on this page are illustrative. Sending, scheduling, and creating conversations require a messaging provider.</p>
        </div>
      </WorkspaceContent>

      <WorkspaceOverview aria-label="Inbox summary" className="grid grid-cols-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm sm:grid-cols-4">
        <SummaryMetric label="Open conversations" value="12" />
        <SummaryMetric label="Need attention" value="3" accent="amber" />
        <SummaryMetric label="Scheduled" value="5" />
        <SummaryMetric label="Urgent" value="1" accent="red" />
      </WorkspaceOverview>

      <WorkspaceContent className="grid min-h-[720px] overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm xl:grid-cols-[190px_340px_minmax(440px,1fr)_300px]">
        <nav aria-label="Guest communications sections" className="border-b border-stone-200 bg-stone-50/70 p-3 xl:border-b-0 xl:border-r">
          <div className="flex gap-1 overflow-x-auto xl:block xl:space-y-1">
            {views.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button key={item.id} type="button" onClick={() => chooseView(item.id)} className={["flex min-w-max items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600 xl:w-full", active ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"].join(" ")} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.count ? <span className={active ? "text-stone-300" : "text-stone-400"}>{item.count}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-5 hidden rounded-2xl border border-stone-200 bg-white p-3 xl:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Channels connected</p>
            <div className="mt-3 flex -space-x-1.5">
              {["A", "V", "B", "S"].map((label) => <span key={label} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-stone-900 text-[9px] font-bold text-white">{label}</span>)}
            </div>
            <p className="mt-2 text-xs leading-5 text-stone-500">Airbnb, VRBO, Booking.com and SMS unified.</p>
          </div>
        </nav>

        <section aria-label="Conversation list" className="border-b border-stone-200 xl:border-b-0 xl:border-r">
          <div className="border-b border-stone-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-stone-950">{views.find((item) => item.id === view)?.label}</h2>
              <button type="button" className="flex items-center gap-1 text-xs font-semibold text-stone-500">Priority <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /></button>
            </div>
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-stone-500 focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600">
              <Search aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">Search conversations</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Guest, property, reservation…" className="w-full bg-transparent text-sm text-stone-950 outline-none placeholder:text-stone-400" />
            </label>
          </div>
          {view === "templates" ? <TemplatesEmpty /> : visible.length ? (
            <div>
              {visible.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === selected?.id} onSelect={() => { setSelectedId(conversation.id); setDraft(""); }} />)}
            </div>
          ) : <ConversationEmpty />}
        </section>

        {selected && view !== "templates" ? (
          <ConversationDetail conversation={selected} draft={draft} setDraft={setDraft} />
        ) : (
          <section className="flex min-h-96 items-center justify-center p-8 text-center">
            <div><FileText className="mx-auto h-7 w-7 text-stone-400" /><h2 className="mt-3 font-semibold">Hospitality templates</h2><p className="mt-2 max-w-xs text-sm leading-6 text-stone-500">Create reusable replies for welcomes, parking, Wi-Fi, checkout, and more.</p></div>
          </section>
        )}

        <AiAssistant conversation={selected} draft={draft} setDraft={setDraft} />
      </WorkspaceContent>
    </WorkspacePage>
  );
}

function SummaryMetric({ label, value, accent }: Readonly<{ label: string; value: string; accent?: "amber" | "red" }>) {
  return <div className="border-b border-r border-stone-200 p-4 last:border-r-0 sm:border-b-0 sm:p-5"><div className="flex items-center gap-2"><span className={["h-2 w-2 rounded-full", accent === "red" ? "bg-red-500" : accent === "amber" ? "bg-amber-500" : "bg-teal-600"].join(" ")} /><p className="text-xs font-semibold text-stone-500">{label}</p></div><p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p></div>;
}

function ConversationRow({ conversation, active, onSelect }: Readonly<{ conversation: Conversation; active: boolean; onSelect: () => void }>) {
  return (
    <button type="button" onClick={onSelect} className={["w-full border-b border-stone-200 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600", active ? "bg-teal-50/70" : "hover:bg-stone-50"].join(" ")}>
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">{conversation.initials}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold text-stone-950">{conversation.guest}</p><span className="shrink-0 text-[11px] text-stone-400">{conversation.time}</span></div>
          <p className="mt-0.5 truncate text-xs text-stone-500">{conversation.property}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">{conversation.preview}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-600">{conversation.stage}</span>
            {conversation.attention ? <span className={["rounded-full px-2 py-1 text-[10px] font-semibold", conversation.attention === "Urgent" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"].join(" ")}>{conversation.attention}</span> : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConversationDetail({ conversation, draft, setDraft }: Readonly<{ conversation: Conversation; draft: string; setDraft: (value: string) => void }>) {
  return (
    <section aria-label={`Conversation with ${conversation.guest}`} className="flex min-h-[650px] flex-col border-b border-stone-200 xl:border-b-0 xl:border-r">
      <header className="border-b border-stone-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold text-stone-950">{conversation.guest}</h2><p className="mt-1 text-xs text-stone-500">{conversation.reservation}</p></div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700">{conversation.status}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-stone-600">
          <span className="flex items-center gap-1.5"><House aria-hidden="true" className="h-3.5 w-3.5" />{conversation.property}</span>
          <span className="flex items-center gap-1.5"><Clock3 aria-hidden="true" className="h-3.5 w-3.5" />{conversation.stage}</span>
          <span className="flex items-center gap-1.5"><MessageCircleMore aria-hidden="true" className="h-3.5 w-3.5" />{conversation.source}</span>
        </div>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto bg-[#faf9f7] p-4 sm:p-6">
        <div className="flex items-center gap-3"><span className="h-px flex-1 bg-stone-200" /><span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{conversation.stage}</span><span className="h-px flex-1 bg-stone-200" /></div>
        {conversation.messages.length ? conversation.messages.map((message, index) => (
          <div key={`${message.time}-${index}`} className={message.from === "host" ? "ml-auto max-w-[85%]" : "max-w-[85%]"}>
            <div className={["rounded-2xl px-4 py-3 text-sm leading-6", message.from === "host" ? "rounded-br-md bg-stone-900 text-white" : "rounded-bl-md border border-stone-200 bg-white text-stone-700"].join(" ")}>{message.body}</div>
            <p className={["mt-1.5 text-[10px] text-stone-400", message.from === "host" ? "text-right" : ""].join(" ")}>{message.time} · {message.source}</p>
          </div>
        )) : <p className="py-16 text-center text-sm text-stone-500">This communication is scheduled. No messages have been sent yet.</p>}
      </div>
      <div className="border-t border-stone-200 bg-white p-4">
        <div className="rounded-2xl border border-stone-200 focus-within:border-teal-600 focus-within:ring-1 focus-within:ring-teal-600">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder={`Reply to ${conversation.guest}…`} className="w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3 text-sm leading-6 text-stone-950 outline-none placeholder:text-stone-400" />
          <div className="flex items-center justify-between border-t border-stone-100 px-3 py-2">
            <span className="flex items-center gap-1 text-[11px] text-stone-400"><Sparkles aria-hidden="true" className="h-3 w-3" />AI drafts require your review</span>
            <button type="button" disabled title="Sending will be enabled when messaging connections are live." className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-stone-950 text-white opacity-30" aria-label="Sending is not yet available"><Send aria-hidden="true" className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AiAssistant({ conversation, draft, setDraft }: Readonly<{ conversation?: Conversation; draft: string; setDraft: (value: string) => void }>) {
  const generate = () => {
    if (!conversation) return;
    setDraft(conversation.id === "maya"
      ? "Hi Maya, I’m sorry the code isn’t working. I’m checking the keypad now. Please try pressing the checkmark after entering 4821; if that doesn’t work, I’ll get you inside right away."
      : `Hi ${conversation.guest.split(" ")[0]}, thanks for reaching out. Let me confirm the details for you and I’ll follow up shortly.`);
  };
  return (
    <aside aria-label="AI assistant" className="bg-stone-50/70 p-4 sm:p-5">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-950 text-teal-100"><Sparkles aria-hidden="true" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-stone-950">AI Assistant</h2><p className="text-[10px] text-stone-500">Assists—never sends</p></div></div>
      {conversation ? <>
        <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Conversation summary</p>
          <p className="mt-2 text-xs leading-5 text-stone-600">{conversation.guest} is in the <strong className="text-stone-800">{conversation.stage.toLowerCase()}</strong> stage at {conversation.property}. {conversation.attention === "Urgent" ? "A timely response is recommended because access may be blocked." : "Their latest message is awaiting a host response."}</p>
        </div>
        {conversation.sentiment ? <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Concern detected.</strong> Acknowledge the issue before giving instructions.</span></div> : null}
        <div className="mt-5 space-y-2">
          <button type="button" onClick={generate} className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-stone-700 outline-none hover:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-600"><WandSparkles aria-hidden="true" className="h-4 w-4 text-teal-700" />Generate a draft</button>
          <button type="button" onClick={() => draft && setDraft(`${draft} Please let me know if there’s anything else I can help with.`)} className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-stone-700 outline-none hover:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-600"><Sparkles aria-hidden="true" className="h-4 w-4 text-teal-700" />Make more hospitable</button>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-stone-700 outline-none hover:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-600"><Languages aria-hidden="true" className="h-4 w-4 text-teal-700" />Translate draft</button>
        </div>
        <div className="mt-5 border-t border-stone-200 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Guest journey</p>
          <div className="mt-3 space-y-3 text-xs">
            <JourneyItem label="Reservation confirmed" complete />
            <JourneyItem label={conversation.stage} current />
            <JourneyItem label="After stay" />
          </div>
        </div>
      </> : null}
    </aside>
  );
}

function JourneyItem({ label, complete, current }: Readonly<{ label: string; complete?: boolean; current?: boolean }>) {
  return <div className="flex items-center gap-2"><span className={["flex h-5 w-5 items-center justify-center rounded-full border", complete ? "border-teal-700 bg-teal-700 text-white" : current ? "border-amber-500 bg-amber-50 text-amber-700" : "border-stone-300 text-stone-300"].join(" ")}>{complete ? <Check aria-hidden="true" className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className={current ? "font-semibold text-stone-800" : "text-stone-500"}>{label}</span></div>;
}

function ConversationEmpty() {
  return <div className="px-6 py-16 text-center"><MessageCircleMore className="mx-auto h-7 w-7 text-stone-400" /><h3 className="mt-3 text-sm font-semibold text-stone-900">Guest conversations will appear here.</h3><p className="mt-2 text-xs leading-5 text-stone-500">Connect your PMS or receive your first reservation to begin communicating with guests.</p></div>;
}

function TemplatesEmpty() {
  return <div className="px-6 py-16 text-center"><FileText className="mx-auto h-7 w-7 text-stone-400" /><h3 className="mt-3 text-sm font-semibold text-stone-900">Create your first template.</h3><p className="mt-2 text-xs leading-5 text-stone-500">Save the hospitality messages you send repeatedly, from Wi-Fi details to checkout.</p></div>;
}
