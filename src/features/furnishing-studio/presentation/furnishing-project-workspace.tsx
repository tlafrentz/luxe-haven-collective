import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Check,
  CheckCircle2,
  Download,
  Heart,
  Layers3,
  QrCode,
  Share2,
  ShoppingCart,
} from "lucide-react";
import { projectProgress } from "@/features/furnishing-studio";

type Row = Record<string, unknown>;
const stages = [
  ["overview", "Room overview"],
  ["design", "Room design"],
  ["products", "Products"],
  ["moodboard", "Mood board"],
  ["budget", "Budget"],
  ["shopping", "Shopping list"],
  ["tracking", "Tracking"],
  ["receiving", "Receiving"],
  ["installation", "Installation"],
  ["photos", "Photography"],
  ["readiness", "Launch readiness"],
  ["handoff", "Handoff"],
] as const;
const roomImages = [
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85",
];

export function FurnishingProjectWorkspace({
  project,
  orders,
  installations,
  punch,
  activity,
  stage: requested,
}: {
  project: Row;
  orders: Row[];
  installations: Row[];
  punch: Row[];
  activity: Row[];
  stage?: string;
}) {
  const stage = stages.some(([id]) => id === requested)
    ? requested!
    : "overview";
  const property = (project.properties as Row) ?? {};
  const selections = (project.selections as Row[]) ?? [];
  const rooms = [
    ...new Set(
      ((project.scope as string[]) ?? []).length
        ? (project.scope as string[])
        : selections.map((item) => String(item.room)),
    ),
  ];
  const budget = (project.budget as Row) ?? {};
  const target = Number(budget.target ?? 0);
  const committed = orders.reduce(
    (sum, order) => sum + Number(order.total ?? 0),
    0,
  );
  const progress = Number(
    project.progress ?? projectProgress(String(project.phase) as never),
  );
  return (
    <main className="min-h-screen bg-[#f5f1e9] pb-20">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-[96rem] px-5 py-7">
          <Link
            href="/dashboard/furnishing"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#17483b]"
          >
            <ArrowLeft className="size-4" /> Furnishing Studio
          </Link>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7142]">
                {String(project.phase).replaceAll("_", " ")} · {progress}%
                complete
              </p>
              <h1 className="mt-2 font-serif text-4xl md:text-5xl">
                {String(project.name)}
              </h1>
              <p className="mt-2 text-stone-500">
                {String(property.name ?? "Property project")} · Target{" "}
                {project.target_install_date
                  ? date(project.target_install_date)
                  : "being scheduled"}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="?stage=moodboard"
                className="rounded-full border px-5 py-2.5 text-sm font-semibold"
              >
                Share design
              </Link>
              <Link
                href="?stage=readiness"
                className="rounded-full bg-[#17483b] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Launch readiness
              </Link>
            </div>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-[#3c816d]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <nav
            aria-label="Project workspace"
            className="mt-6 overflow-x-auto border-t"
          >
            <ul className="flex min-w-max gap-6">
              {stages.map(([id, label]) => (
                <li key={id}>
                  <Link
                    href={`?stage=${id}`}
                    aria-current={stage === id ? "page" : undefined}
                    className={`block border-b-2 py-4 text-sm font-semibold ${stage === id ? "border-[#17483b] text-[#17483b]" : "border-transparent text-stone-500"}`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-[96rem] px-5 py-8">
        {stage === "overview" ? (
          <RoomOverview
            rooms={rooms}
            selections={selections}
            installations={installations}
            target={target}
          />
        ) : null}
        {stage === "design" ? (
          <RoomDesign
            room={rooms[0] ?? "Living Room"}
            selections={selections}
          />
        ) : null}
        {stage === "products" ? <Products selections={selections} /> : null}
        {stage === "moodboard" ? <MoodBoard /> : null}
        {stage === "budget" ? (
          <Budget
            target={target}
            committed={committed}
            orders={orders}
            budget={budget}
          />
        ) : null}
        {stage === "shopping" ? <ShoppingList selections={selections} /> : null}
        {stage === "tracking" ? <Tracking orders={orders} /> : null}
        {stage === "receiving" ? (
          <Receiving installations={installations} />
        ) : null}
        {stage === "installation" ? (
          <Installation installations={installations} />
        ) : null}
        {stage === "photos" ? <Photography rooms={rooms} /> : null}
        {stage === "readiness" ? (
          <Readiness
            project={project}
            orders={orders}
            installations={installations}
            punch={punch}
          />
        ) : null}
        {stage === "handoff" ? (
          <Handoff
            project={project}
            property={property}
            progress={progress}
            target={target}
            rooms={rooms}
          />
        ) : null}
        <Activity items={activity} />
      </div>
    </main>
  );
}

function Title({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7142]">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-stone-600">{description}</p>
    </header>
  );
}
function RoomOverview({
  rooms,
  selections,
  installations,
  target,
}: {
  rooms: string[];
  selections: Row[];
  installations: Row[];
  target: number;
}) {
  return (
    <section>
      <Title
        eyebrow="Design"
        title="Your rooms at a glance"
        description="Move from the whole-property plan into each curated room."
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room, index) => {
          const items = selections.filter((item) => item.room === room);
          const tasks = installations.filter((item) => item.room === room);
          const complete = tasks.filter(
            (item) => item.status === "installed",
          ).length;
          return (
            <Link
              key={room}
              href="?stage=design"
              className="group overflow-hidden rounded-[1.5rem] border bg-white"
            >
              <div className="relative aspect-[16/10]">
                <Image
                  src={roomImages[index % roomImages.length]}
                  alt=""
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">
                  {complete}/{tasks.length || items.length} complete
                </span>
              </div>
              <div className="p-5">
                <div className="flex justify-between">
                  <h3 className="font-serif text-2xl">{room}</h3>
                  <ArrowRight className="size-5 text-stone-300" />
                </div>
                <p className="mt-2 text-sm text-stone-500">
                  {items.length} curated items ·{" "}
                  {money(rooms.length ? target / rooms.length : 0)} allocation
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
function RoomDesign({ room, selections }: { room: string; selections: Row[] }) {
  const items = selections.filter((item) => item.room === room);
  return (
    <section>
      <Title
        eyebrow="Room design"
        title={room}
        description="A cohesive room concept, curated products, and alternatives designed for hospitality."
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
        <div className="relative min-h-[520px] overflow-hidden rounded-[2rem]">
          <Image
            src={roomImages[0]}
            alt={`${room} design concept`}
            fill
            className="object-cover"
          />
          <span className="absolute bottom-5 left-5 rounded-full bg-white px-4 py-2 text-xs font-semibold shadow">
            Room rendering · Concept 01
          </span>
        </div>
        <div className="space-y-4">
          <Panel title="Design direction">
            <p className="text-sm leading-6 text-stone-600">
              Warm natural materials, durable upholstery, layered lighting, and
              a calm neutral palette built for repeat guest use.
            </p>
            <div className="mt-5 flex gap-2">
              {["#E7DFD2", "#9C8064", "#344B42", "#D1B482"].map((color) => (
                <span
                  key={color}
                  className="size-9 rounded-full border"
                  style={{ background: color }}
                />
              ))}
            </div>
          </Panel>
          <Panel title="Primary selections">
            <ul className="space-y-3">
              {(items.length
                ? items
                : [
                    { itemName: "Performance sofa" },
                    { itemName: "Oak coffee table" },
                    { itemName: "Layered lighting" },
                  ]
              )
                .slice(0, 5)
                .map((item, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{String(item.itemName)}</span>
                    <CheckCircle2 className="size-4 text-emerald-700" />
                  </li>
                ))}
            </ul>
            <Link
              href="?stage=products"
              className="mt-5 inline-flex text-sm font-semibold text-[#17483b]"
            >
              Review every product →
            </Link>
          </Panel>
        </div>
      </div>
    </section>
  );
}
function Products({ selections }: { selections: Row[] }) {
  const values = selections.length
    ? selections
    : [
        {
          itemName: "Performance sofa",
          room: "Living Room",
          category: "Furniture",
          quantity: 1,
        },
        {
          itemName: "Solid oak dining table",
          room: "Dining Room",
          category: "Furniture",
          quantity: 1,
        },
        {
          itemName: "Hotel-grade bed frame",
          room: "Primary Bedroom",
          category: "Bed & bath",
          quantity: 1,
        },
      ];
  return (
    <section>
      <Title
        eyebrow="Product selections"
        title="Every piece, chosen for you"
        description="Compare, favorite, and request replacements before selections become orders."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {values.map((item, index) => (
          <article
            key={`${String(item.itemName)}-${index}`}
            className="rounded-2xl border bg-white p-4"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
              <Image
                src={roomImages[index % roomImages.length]}
                alt=""
                fill
                className="object-cover"
              />
              <button
                aria-label="Favorite product"
                className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white"
              >
                <Heart className="size-4" />
              </button>
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-stone-400">
              {String(item.room ?? item.category)}
            </p>
            <h3 className="mt-1 font-serif text-xl">{String(item.itemName)}</h3>
            <p className="mt-2 text-sm text-stone-500">
              Hospitality-grade · In stock · Qty {String(item.quantity ?? 1)}
            </p>
            <div className="mt-5 flex gap-2">
              <button className="rounded-full border px-4 py-2 text-xs font-semibold">
                Replace
              </button>
              <button className="rounded-full border px-4 py-2 text-xs font-semibold">
                Compare
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function MoodBoard() {
  return (
    <section>
      <Title
        eyebrow="Mood board"
        title="The look and feel"
        description="A shareable, versioned creative direction for the entire property."
      />
      <div className="grid grid-cols-2 gap-3 rounded-[2rem] border bg-white p-4 md:grid-cols-4">
        {roomImages.concat(roomImages.slice(0, 2)).map((image, index) => (
          <div
            key={`${image}-${index}`}
            className={`relative overflow-hidden rounded-xl ${index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}
          >
            <Image src={image} alt="" fill className="object-cover" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="inline-flex items-center gap-2 rounded-full border bg-white px-5 py-3 text-sm font-semibold">
          <Share2 className="size-4" /> Share board
        </button>
        <button className="inline-flex items-center gap-2 rounded-full border bg-white px-5 py-3 text-sm font-semibold">
          <Download className="size-4" /> Export PDF
        </button>
        <button className="inline-flex items-center gap-2 rounded-full border bg-white px-5 py-3 text-sm font-semibold">
          <Layers3 className="size-4" /> Version history
        </button>
      </div>
    </section>
  );
}
function Budget({
  target,
  committed,
  orders,
  budget,
}: {
  target: number;
  committed: number;
  orders: Row[];
  budget: Row;
}) {
  const remaining = target - committed;
  const percent = target ? Math.round((committed / target) * 100) : 0;
  return (
    <section>
      <Title
        eyebrow="Budget summary"
        title="You’re on track"
        description="Live project costs, commitments, remaining budget, and variance."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <BudgetMetric label="Target" value={money(target)} />
        <BudgetMetric label="Ordered" value={money(committed)} />
        <BudgetMetric
          label="Remaining"
          value={money(remaining)}
          tone={remaining < 0 ? "warning" : "default"}
        />
        <BudgetMetric label="Committed" value={`${percent}%`} />
      </div>
      <Panel title="Budget allocation">
        <div className="h-4 overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full ${percent > 100 ? "bg-amber-600" : "bg-[#3c816d]"}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ["Products", Number(budget.target ?? 0)],
            ["Contingency", Number(budget.contingency ?? 0)],
            ["Delivery", Number(budget.delivery ?? 0)],
            ["Installation", Number(budget.installation ?? 0)],
            ["Taxes", Number(budget.tax ?? 0)],
            [
              "Orders",
              orders.reduce((sum, item) => sum + Number(item.total ?? 0), 0),
            ],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="flex justify-between border-b py-3 text-sm"
            >
              <span className="text-stone-500">{label}</span>
              <strong>{money(Number(value))}</strong>
            </div>
          ))}
        </div>
        {remaining < 0 ? (
          <p
            role="alert"
            className="mt-5 flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            <AlertTriangle className="size-4" /> Budget exceeded. Review
            alternatives before approving more orders.
          </p>
        ) : null}
      </Panel>
    </section>
  );
}
function ShoppingList({ selections }: { selections: Row[] }) {
  const values = selections.length
    ? selections
    : [
        {
          room: "Living Room",
          itemName: "Sofa",
          quantity: 1,
          procurementStatus: "not_ordered",
        },
      ];
  return (
    <section>
      <Title
        eyebrow="Procurement"
        title="Shopping list"
        description="Every approved item grouped by room and ready for vendor selection."
      />
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="grid grid-cols-[1fr_140px_120px] border-b bg-stone-50 p-4 text-xs font-bold uppercase tracking-[.14em] text-stone-400">
          <span>Item</span>
          <span>Room</span>
          <span>Status</span>
        </div>
        {values.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_140px_120px] items-center border-b p-4 text-sm last:border-0"
          >
            <span className="font-semibold">{String(item.itemName)}</span>
            <span className="text-stone-500">{String(item.room)}</span>
            <Status value={String(item.procurementStatus ?? "ready")} />
          </div>
        ))}
      </div>
      <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#17483b] px-6 py-3 text-sm font-semibold text-white">
        <ShoppingCart className="size-4" /> Continue to orders
      </button>
    </section>
  );
}
function Tracking({ orders }: { orders: Row[] }) {
  return (
    <section>
      <Title
        eyebrow="Procurement"
        title="Shipment tracking"
        description="Multiple vendors and deliveries, organized into one launch timeline."
      />
      {orders.length ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <article
              key={String(order.id)}
              className="rounded-2xl border bg-white p-6"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-stone-400">
                    {String(order.po_number)}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl">
                    {String(order.vendor)}
                  </h3>
                </div>
                <Status value={String(order.status)} />
              </div>
              <div className="mt-6 grid grid-cols-5 text-center text-xs">
                {[
                  "Confirmed",
                  "Processing",
                  "Shipped",
                  "Out for delivery",
                  "Delivered",
                ].map((label, index) => (
                  <div key={label} className="relative">
                    <span
                      className={`mx-auto grid size-6 place-items-center rounded-full ${index <= orderIndex(String(order.status)) ? "bg-[#17483b] text-white" : "bg-stone-100 text-stone-400"}`}
                    >
                      {index <= orderIndex(String(order.status)) ? (
                        <Check className="size-3" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <p className="mt-2 text-stone-500">{label}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="Tracking appears as soon as approved orders are placed." />
      )}
    </section>
  );
}
function Receiving({ installations }: { installations: Row[] }) {
  const delivered = installations.filter((item) =>
    ["ready", "installed"].includes(String(item.status)),
  ).length;
  const issues = installations.filter((item) =>
    ["damaged", "missing", "incorrect"].includes(String(item.status)),
  );
  return (
    <section>
      <Title
        eyebrow="Installation"
        title="Receiving"
        description="Know what arrived, what is outstanding, and what needs attention."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <BudgetMetric label="Expected" value={String(installations.length)} />
        <BudgetMetric label="Received" value={String(delivered)} />
        <BudgetMetric
          label="Exceptions"
          value={String(issues.length)}
          tone={issues.length ? "warning" : "default"}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {installations.slice(0, 12).map((item) => (
          <article
            key={String(item.id)}
            className="flex items-center gap-4 rounded-2xl border bg-white p-4"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-stone-100">
              <Box className="size-5 text-stone-500" />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">
                {String(item.item_name)}
              </h3>
              <p className="mt-1 text-xs text-stone-500">{String(item.room)}</p>
            </div>
            <Status value={String(item.status)} />
          </article>
        ))}
      </div>
    </section>
  );
}
function Installation({ installations }: { installations: Row[] }) {
  const grouped = installations.reduce<Record<string, Row[]>>(
    (result, item) => {
      const room = String(item.room);
      (result[room] ??= []).push(item);
      return result;
    },
    {},
  );
  return (
    <section>
      <Title
        eyebrow="Installation"
        title="Room-by-room checklist"
        description="Track placement, condition, dependencies, and final guest-ready details."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {Object.entries(grouped).map(([room, items]) => (
          <Panel key={room} title={room}>
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={String(item.id)} className="flex items-center gap-3">
                  <span
                    className={`grid size-6 place-items-center rounded-full ${item.status === "installed" ? "bg-[#17483b] text-white" : "border text-stone-300"}`}
                  >
                    {item.status === "installed" ? (
                      <Check className="size-3" />
                    ) : null}
                  </span>
                  <span className="flex-1 text-sm">
                    {String(item.item_name)}
                  </span>
                  <Status value={String(item.status)} />
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </section>
  );
}
function Photography({ rooms }: { rooms: string[] }) {
  return (
    <section>
      <Title
        eyebrow="Handoff"
        title="Final photography"
        description="Capture the finished property for listings, Guidebook Studio, and launch records."
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {rooms.map((room, index) => (
          <article
            key={room}
            className="overflow-hidden rounded-2xl border bg-white"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={roomImages[index % roomImages.length]}
                alt=""
                fill
                className="object-cover"
              />
              <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white text-emerald-700">
                <Check className="size-4" />
              </span>
            </div>
            <div className="flex items-center justify-between p-4">
              <p className="text-sm font-semibold">{room}</p>
              <button className="text-xs font-semibold text-[#17483b]">
                Replace
              </button>
            </div>
          </article>
        ))}
        <button className="grid min-h-48 place-items-center rounded-2xl border-2 border-dashed bg-white text-stone-400">
          <span>
            <Camera className="mx-auto size-6" />
            <span className="mt-2 block text-sm font-semibold">
              Upload photos
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
function Readiness({
  project,
  orders,
  installations,
  punch,
}: {
  project: Row;
  orders: Row[];
  installations: Row[];
  punch: Row[];
}) {
  const checks = [
    [
      "Furniture delivered",
      orders.length > 0 && orders.every((item) => item.status === "delivered"),
      true,
    ],
    [
      "Installation complete",
      installations.length > 0 &&
        installations.every((item) =>
          ["installed", "not_required"].includes(String(item.status)),
        ),
      true,
    ],
    [
      "Critical issues resolved",
      punch.every(
        (item) => item.status === "resolved" || item.severity !== "critical",
      ),
      true,
    ],
    [
      "Final photography",
      String(project.phase) === "complete" || Number(project.progress) >= 95,
      false,
    ],
    ["Guidebook prepared", String(project.phase) === "complete", true],
    ["Cleaning and utilities", Number(project.progress) >= 95, true],
  ] as const;
  const criticalReady = checks
    .filter((item) => item[2])
    .every((item) => item[1]);
  const score = Math.round(
    (checks.filter((item) => item[1]).length / checks.length) * 100,
  );
  return (
    <section>
      <Title
        eyebrow="Launch readiness"
        title={
          criticalReady ? "Ready to welcome guests" : "Your launch checklist"
        }
        description="Critical requirements must be complete before the property moves into operations."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="divide-y rounded-2xl border bg-white">
          {checks.map(([label, done, critical]) => (
            <div key={label} className="flex items-center gap-4 p-5">
              <span
                className={`grid size-8 place-items-center rounded-full ${done ? "bg-[#17483b] text-white" : "border border-stone-300 text-stone-300"}`}
              >
                {done ? <Check className="size-4" /> : null}
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{label}</h3>
                <p className="mt-1 text-xs text-stone-400">
                  {critical ? "Required to launch" : "Recommended"}
                </p>
              </div>
              {!done && critical ? (
                <span className="text-xs font-semibold text-amber-700">
                  Blocking
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="rounded-[2rem] bg-[#17483b] p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-200">
            Completion score
          </p>
          <p className="mt-3 font-serif text-6xl">{score}%</p>
          <div className="mt-5 h-2 rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="mt-5 text-sm leading-6 text-white/75">
            {criticalReady
              ? "Every critical launch requirement is complete."
              : "Complete the blocking items before handoff."}
          </p>
          <Link
            href="?stage=handoff"
            aria-disabled={!criticalReady}
            className={`mt-6 inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#17483b] ${criticalReady ? "" : "pointer-events-none opacity-45"}`}
          >
            Continue to handoff
          </Link>
        </div>
      </div>
    </section>
  );
}
function Handoff({
  project,
  property,
  progress,
  target,
  rooms,
}: {
  project: Row;
  property: Row;
  progress: number;
  target: number;
  rooms: string[];
}) {
  return (
    <section>
      <Title
        eyebrow="Project handoff"
        title={
          progress >= 100
            ? "Congratulations—your property is ready"
            : "The final step: your guest experience"
        }
        description="Furnishing Studio hands the finished property directly into Guidebook Studio."
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-[450px] overflow-hidden rounded-[2rem]">
          <Image
            src={String(property.featured_image || roomImages[0])}
            alt=""
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white">
            <p className="text-xs uppercase tracking-[.18em] text-[#e5cda8]">
              Launch-ready property
            </p>
            <h3 className="mt-2 font-serif text-4xl">
              {String(property.name)}
            </h3>
            <p className="mt-3 text-sm text-white/70">
              {rooms.length} rooms · {money(target)} target budget · {progress}%
              complete
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <Panel title="Guidebook Studio ready">
            <span className="grid size-12 place-items-center rounded-full bg-[#edf3ef] text-[#17483b]">
              <QrCode className="size-6" />
            </span>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              Property details and finished photography are ready to become a
              beautiful digital guest guide.
            </p>
            <Link
              href={`/dashboard/guidebooks/new?property=${String(project.property_id)}`}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#17483b] px-6 py-3 text-sm font-semibold text-white"
            >
              Open Guidebook Studio <ArrowRight className="size-4" />
            </Link>
          </Panel>
          <Panel title="Project complete">
            <p className="text-sm leading-6 text-stone-600">
              Review the final project timeline, budget, rooms, and launch
              record any time.
            </p>
            <Link
              href="/dashboard/furnishing"
              className="mt-5 inline-flex text-sm font-semibold text-[#17483b]"
            >
              Go to project dashboard →
            </Link>
          </Panel>
        </div>
      </div>
    </section>
  );
}
function Activity({ items }: { items: Row[] }) {
  if (!items.length) return null;
  return (
    <aside className="mt-10 border-t pt-7">
      <h2 className="font-serif text-2xl">Project activity</h2>
      <ol className="mt-4 grid gap-3 md:grid-cols-2">
        {items.slice(0, 6).map((item) => (
          <li key={String(item.id)} className="rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold">{String(item.summary)}</p>
            <p className="mt-2 text-xs text-stone-400">
              {date(item.occurred_at)}
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h3 className="font-serif text-2xl">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function BudgetMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <article
      className={`rounded-2xl border p-5 ${tone === "warning" ? "border-amber-200 bg-amber-50" : "bg-white"}`}
    >
      <p className="text-xs font-bold uppercase tracking-[.14em] text-stone-400">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </article>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-[#edf3ef] px-3 py-1 text-xs font-semibold capitalize text-[#17483b]">
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-stone-500">
      {text}
    </div>
  );
}
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
const date = (value: unknown) =>
  new Date(String(value)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const orderIndex = (status: string) =>
  ({
    draft: 0,
    ready_to_order: 0,
    ordered: 1,
    partially_fulfilled: 1,
    shipped: 2,
    delivered: 4,
  })[status] ?? 0;
