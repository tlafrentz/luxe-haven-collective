import Link from "next/link";
import {
  assessLaunchReadinessAction,
  authorizeLaunchAction,
  createLaunchHandoffAction,
  getInstallationAvailability,
  getInstallationWorkspace,
  recordInstallationEvidenceAction,
  startInstallationAction,
  updateInstallationTaskAction,
  updateReadinessCheckAction,
} from "@/app/actions/furnishing-installation";
import { completeProjectAction } from "@/app/actions/furnishing-project-workspace";
type Row = Record<string, unknown>;
const label = (value: unknown) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
export async function InstallationWorkspace({
  projectId,
  customer = false,
  view = "overview",
}: {
  projectId: string;
  customer?: boolean;
  view?: string;
}) {
  const availability = await getInstallationAvailability(projectId);
  if (!availability.available)
    return (
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <section
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-9"
        >
          <h1 className="text-3xl font-semibold">Installation unavailable</h1>
          <p className="mt-3">
            Installation is not enabled for the internal Furnishing cohort. No
            installation project or schedule can be created.
          </p>
        </section>
      </main>
    );
  const data = await getInstallationWorkspace(projectId),
    project = data.project as Row,
    installation = data.installation as Row | null,
    tasks = data.tasks as Row[],
    checks = data.checks as Row[],
    punch = data.punch as Row[],
    rooms = data.rooms as Row[],
    sessions = data.sessions as Row[],
    assessments = data.assessments as Row[],
    events = data.events as Row[],
    evidence = (data as Row).evidence as Row[],
    authorizations = (data as Row).authorizations as Row[],
    handoff = (data as Row).handoff as Row | null,
    base = `/${customer ? "dashboard" : "admin"}/furnishing/projects/${projectId}/installation`;
  if (!installation)
    return (
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <Link
          href={`/${customer ? "dashboard" : "admin"}/furnishing/projects/${projectId}/procurement`}
          className="text-sm text-muted-foreground"
        >
          ← Procurement
        </Link>
        <section className="mt-8 rounded-2xl border bg-white p-9 text-center">
          <h1 className="text-3xl font-semibold">Installation and launch</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Once procurement is closed, create the installation workspace from
            accepted furnishings. Design and purchasing history remain
            unchanged.
          </p>
          <form className="mt-7" action={startInstallationAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`installation-${projectId}`}
            />
            <button className="rounded-md bg-amber-700 px-6 py-3 font-medium text-white">
              Start installation planning
            </button>
          </form>
        </section>
      </main>
    );
  const tabs = [
      "overview",
      "schedule",
      "rooms",
      "photos",
      "readiness",
      "punch_list",
      "launch",
      "handoff",
      "activity",
    ],
    complete = tasks.filter((x) =>
      ["complete", "accepted", "installed"].includes(String(x.status)),
    ).length,
    blocking = punch.filter(
      (x) => x.blocking_launch && x.status !== "resolved",
    ).length,
    current = assessments[0],
    percent = Number(
      current?.readiness_percent ??
        Math.round(
          (checks.filter((x) => x.status === "passed").length /
            Math.max(1, checks.length)) *
            100,
        ),
    ),
    authorizedDecision = authorizations.find(
      (a) => a.decision === "authorized",
    );
  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b bg-white px-5 py-5 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs uppercase tracking-widest text-amber-700">
            Furnishing · Installation & Launch
          </p>
          <div className="mt-1 flex flex-wrap justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">
                {String(project.name ?? "Furnishing project")}
              </h1>
              <p className="text-sm text-muted-foreground">
                Installation converts accepted procurement into verified launch
                outcomes.
              </p>
            </div>
            <span className="h-fit rounded-full border px-3 py-1 text-sm">
              {label(installation.status)}
            </span>
          </div>
          <nav className="mt-5 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab}
                href={`${base}?view=${tab}`}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${view === tab ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}
              >
                {label(tab)}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-5 lg:p-10">
        {view === "overview" && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric name="Site readiness" value={`${percent}%`} />
              <Metric
                name="Rooms accepted"
                value={`${rooms.filter((x) => x.status === "accepted").length} of ${rooms.length}`}
              />
              <Metric
                name="Tasks complete"
                value={`${complete} of ${tasks.length}`}
              />
              <Metric name="Launch blockers" value={String(blocking)} />
            </section>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <Panel title="Needs attention">
                {checks
                  .filter((x) => x.status === "failed")
                  .map((x) => (
                    <Line
                      key={String(x.id)}
                      left={String(x.name)}
                      right="Blocked"
                    />
                  ))}
                {punch
                  .filter((x) => x.status !== "resolved")
                  .map((x) => (
                    <Line
                      key={String(x.id)}
                      left={String(x.issue)}
                      right={label(x.severity)}
                    />
                  ))}
                {blocking === 0 &&
                checks.every((x) => x.status !== "failed") ? (
                  <p className="text-muted-foreground">
                    No current blocking issues.
                  </p>
                ) : null}
              </Panel>
              <Panel title="Room progress">
                <RoomProgress tasks={tasks} />
              </Panel>
            </div>
          </>
        )}
        {view === "schedule" && (
          <Panel title="Installation plan and schedule">
            {sessions.length ? (
              <div>
                {sessions.map((x) => (
                  <Line
                    key={String(x.id)}
                    left={String(x.name)}
                    right={`${new Date(String(x.starts_at)).toLocaleDateString()} · ${label(x.status)}`}
                  />
                ))}
              </div>
            ) : (
              <Empty text="No work sessions scheduled. Create sessions after crews and delivery windows are confirmed." />
            )}
          </Panel>
        )}
        {view === "rooms" && (
          <InstallationChecklist tasks={tasks} projectId={projectId} />
        )}
        {view === "photos" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Panel title="Final photos">
              <p className="mb-4 text-sm text-muted-foreground">
                Photos are stored privately by default. Submitting a photo here
                does not grant permission to use it for marketing or portfolio
                purposes — that requires separate, explicit consent.
              </p>
              {evidence.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {evidence.map((x) => (
                    <div
                      key={String(x.id)}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <p className="truncate font-medium">
                        {String(
                          (x.furnishing_installation_tasks as Row | undefined)
                            ?.item_name ?? "Task photo",
                        )}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {String(x.storage_path)}
                      </p>
                      {x.caption ? (
                        <p className="mt-1 text-xs">{String(x.caption)}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Private · captured{" "}
                        {new Date(String(x.captured_at)).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No final photos captured yet." />
              )}
            </Panel>
            <Panel title="Add a photo">
              <form
                action={recordInstallationEvidenceAction}
                className="grid gap-3"
              >
                <input type="hidden" name="projectId" value={projectId} />
                <label className="grid gap-1 text-sm font-medium">
                  Task
                  <select
                    name="taskId"
                    required
                    className="rounded-md border bg-white px-3 py-2"
                  >
                    <option value="">Select task</option>
                    {tasks.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        {String(t.item_name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Photo reference or URL
                  <input
                    name="storagePath"
                    required
                    className="rounded-md border bg-white px-3 py-2"
                    placeholder="Storage path or link"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Caption (optional)
                  <input
                    name="caption"
                    className="rounded-md border bg-white px-3 py-2"
                  />
                </label>
                <button className="rounded-md bg-amber-700 px-4 py-2.5 text-white">
                  Save photo
                </button>
              </form>
            </Panel>
          </div>
        )}
        {view === "readiness" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Panel title="Site readiness">
              {checks.map((x) => (
                <form
                  action={updateReadinessCheckAction}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-0"
                  key={String(x.id)}
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="checkId" value={String(x.id)} />
                  <span>
                    <strong>{String(x.name)}</strong>
                    <small className="block text-muted-foreground">
                      {label(x.category)}
                    </small>
                  </span>
                  <select
                    name="status"
                    defaultValue={String(x.status)}
                    className="rounded-md border bg-white px-3 py-2"
                  >
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                  <button className="rounded-md border px-3 py-2 text-sm">
                    Save
                  </button>
                </form>
              ))}
            </Panel>
            <Panel title="Launch blockers">
              <p className="text-3xl font-semibold text-red-700">{blocking}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Human authorization remains unavailable until every required
                blocker is resolved.
              </p>
            </Panel>
          </div>
        )}
        {view === "punch_list" && (
          <Panel title="Punch list">
            {punch.length ? (
              punch.map((x) => (
                <Line
                  key={String(x.id)}
                  left={String(x.issue)}
                  right={x.blocking_launch ? "Launch blocker" : label(x.status)}
                />
              ))
            ) : (
              <Empty text="No punch-list items. Damage, missing items, workmanship, safety, and technology issues will appear here." />
            )}
          </Panel>
        )}
        {view === "launch" && (
          <LaunchPanel
            current={current}
            checks={checks}
            blocking={blocking}
            percent={percent}
            projectId={projectId}
            authorizations={authorizations}
          />
        )}
        {view === "handoff" && (
          <HandoffPanel
            authorizedDecision={authorizedDecision}
            handoff={handoff}
            punch={punch}
            projectId={projectId}
            customer={customer}
            lifecycleStatus={String(project.lifecycle_status ?? "")}
          />
        )}
        {view === "activity" && (
          <Panel title="Immutable activity">
            {events.length ? (
              events.map((x) => (
                <Line
                  key={String(x.id)}
                  left={label(x.event_type)}
                  right={new Date(String(x.occurred_at)).toLocaleString()}
                />
              ))
            ) : (
              <Empty text="No installation events recorded." />
            )}
          </Panel>
        )}
      </div>
    </main>
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
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Metric({ name, value }: { name: string; value: string }) {
  return (
    <article className="rounded-xl border bg-white p-5">
      <p className="text-sm text-muted-foreground">{name}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}
function Line({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-3 last:border-0">
      <span>{left}</span>
      <span className="text-sm text-muted-foreground">{right}</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-stone-50 p-8 text-center text-muted-foreground">
      {text}
    </p>
  );
}
function LaunchPanel({
  current,
  checks,
  blocking,
  percent,
  projectId,
  authorizations,
}: {
  current: Row | undefined;
  checks: Row[];
  blocking: number;
  percent: number;
  projectId: string;
  authorizations: Row[];
}) {
  const decision = current
    ? authorizations.find((a) => a.assessment_id === current.id)
    : undefined;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Panel title="Launch readiness">
        <p className="text-3xl font-semibold">
          {current
            ? `${percent}% · ${current.ready_for_authorization ? "Ready for review" : "Conditionally ready"}`
            : "Not assessed"}
        </p>
        <div className="mt-5">
          {checks.map((x) => (
            <Line
              key={String(x.id)}
              left={String(x.name)}
              right={label(x.status)}
            />
          ))}
        </div>
        <form action={assessLaunchReadinessAction} className="mt-5">
          <input type="hidden" name="projectId" value={projectId} />
          <button className="rounded-md bg-amber-700 px-5 py-3 text-white">
            Run readiness assessment
          </button>
        </form>
      </Panel>
      <Panel title={`${blocking} blocking items`}>
        <p className="text-sm text-muted-foreground">
          The readiness score is advisory only. Launch never proceeds
          automatically — an authorized person must review the current
          assessment and make an explicit, recorded decision.
        </p>
        {!current ? (
          <p className="mt-5 text-sm text-amber-700">
            Run a readiness assessment before a launch decision can be recorded.
          </p>
        ) : decision ? (
          <div className="mt-5 rounded-lg border p-4">
            <p className="font-semibold capitalize">
              {label(decision.decision)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Decided {new Date(String(decision.decided_at)).toLocaleString()}
            </p>
            {decision.reason ? (
              <p className="mt-2 text-sm">{String(decision.reason)}</p>
            ) : null}
          </div>
        ) : (
          <form action={authorizeLaunchAction} className="mt-5 space-y-3">
            <input type="hidden" name="projectId" value={projectId} />
            <select
              name="decision"
              required
              className="w-full rounded-md border bg-white px-3 py-2"
            >
              <option value="">Select decision</option>
              <option
                value="authorized"
                disabled={!current.ready_for_authorization}
              >
                Authorize launch
                {current.ready_for_authorization ? "" : " (readiness not met)"}
              </option>
              <option value="returned_for_work">Return for work</option>
              <option value="blocked">Block launch</option>
            </select>
            <input
              name="reason"
              placeholder="Reason (optional for authorize, recommended otherwise)"
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            />
            <button className="w-full rounded-md border border-red-300 px-4 py-3 text-red-700">
              Record launch decision
            </button>
          </form>
        )}
      </Panel>
    </div>
  );
}
function HandoffPanel({
  authorizedDecision,
  handoff,
  punch,
  projectId,
  customer,
  lifecycleStatus,
}: {
  authorizedDecision: Row | undefined;
  handoff: Row | null;
  punch: Row[];
  projectId: string;
  customer: boolean;
  lifecycleStatus: string;
}) {
  if (!authorizedDecision)
    return (
      <Panel title="Launch property">
        <p className="rounded-lg bg-stone-50 p-8 text-center text-muted-foreground">
          Handoff becomes available once launch is authorized on the Launch tab.
        </p>
      </Panel>
    );
  const openItems =
    (handoff?.open_nonblocking_items as Row[] | undefined) ??
    punch
      .filter((p) => !p.blocking_launch && p.status !== "resolved")
      .map((p) => ({ id: p.id, issue: p.issue }));
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Panel title="Launch property">
        <p className="text-sm text-muted-foreground">
          This property is authorized to launch.{" "}
          {lifecycleStatus === "completed"
            ? "The project has been completed."
            : "Complete the handoff below, then close out the project."}
        </p>
        {!handoff ? (
          <form action={createLaunchHandoffAction} className="mt-5">
            <input type="hidden" name="projectId" value={projectId} />
            <button className="rounded-md bg-amber-700 px-5 py-3 text-white">
              Record handoff
            </button>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Outstanding non-blocking items
              </p>
              {openItems.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {openItems.map((x: Row) => (
                    <li key={String(x.id)}>{String(x.issue)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  None — everything is resolved.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Handed off{" "}
              {new Date(String(handoff.handed_off_at)).toLocaleString()}
            </p>
          </div>
        )}
      </Panel>
      <Panel title="Continue the guest experience">
        <p className="text-sm text-muted-foreground">
          Furnishing is complete — set up the property&apos;s digital guidebook
          next.
        </p>
        <Link
          href={customer ? "/dashboard/guidebooks/new" : "/guidebook-studio"}
          className="mt-4 flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white"
        >
          Open Guidebook Studio →
        </Link>
        {handoff && lifecycleStatus !== "completed" ? (
          <form action={completeProjectAction} className="mt-4">
            <input type="hidden" name="projectId" value={projectId} />
            <button className="w-full rounded-md border border-emerald-700 px-4 py-3 text-sm font-semibold text-emerald-800">
              Complete project
            </button>
          </form>
        ) : null}
        {lifecycleStatus === "completed" ? (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-800">
            Project complete
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
function InstallationChecklist({
  tasks,
  projectId,
}: {
  tasks: Row[];
  projectId: string;
}) {
  const rooms = new Map<string, { name: string; tasks: Row[] }>();
  for (const t of tasks) {
    const id = String(t.room_id),
      room = t.furnishing_rooms as Row | undefined,
      entry = rooms.get(id) ?? {
        name: String(room?.name ?? t.room ?? "Unassigned"),
        tasks: [],
      };
    entry.tasks.push(t);
    rooms.set(id, entry);
  }
  if (!rooms.size)
    return (
      <Panel title="Room installation">
        <Empty text="No accepted procurement items are ready for installation." />
      </Panel>
    );
  return (
    <div className="space-y-5">
      {[...rooms.values()].map((room) => (
        <Panel key={room.name} title={room.name}>
          <div className="space-y-3">
            {room.tasks.map((t) => (
              <form
                key={String(t.id)}
                action={updateInstallationTaskAction}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
              >
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="taskId" value={String(t.id)} />
                <div>
                  <p className="font-medium">{String(t.item_name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {label(t.task_type)} · Qty {String(t.quantity_expected)}
                    {t.accepted_by && t.accepted_at
                      ? ` · Accepted ${new Date(String(t.accepted_at)).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    name="status"
                    defaultValue={String(t.status)}
                    className="rounded-md border bg-white px-3 py-2 text-sm"
                  >
                    <option value="ready">Ready</option>
                    <option value="in_progress">In Progress</option>
                    <option value="installed">Installed</option>
                    <option value="complete">Complete</option>
                    <option value="accepted">Accepted</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                    <option value="incorrect">Incorrect</option>
                    <option value="deferred">Deferred</option>
                  </select>
                  <button className="rounded-md border px-3 py-2 text-sm font-medium">
                    Save
                  </button>
                </div>
              </form>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
function RoomProgress({ tasks }: { tasks: Row[] }) {
  const rooms = new Map<
    string,
    { name: string; total: number; done: number }
  >();
  for (const x of tasks) {
    const id = String(x.room_id),
      room = x.furnishing_rooms as Row | undefined,
      row = rooms.get(id) ?? {
        name: String(room?.name ?? x.room ?? "Unassigned"),
        total: 0,
        done: 0,
      };
    row.total++;
    if (["complete", "accepted", "installed"].includes(String(x.status)))
      row.done++;
    rooms.set(id, row);
  }
  return rooms.size ? (
    <div>
      {[...rooms.values()].map((x) => (
        <Line
          key={x.name}
          left={x.name}
          right={`${Math.round((x.done / Math.max(1, x.total)) * 100)}% · ${x.done}/${x.total}`}
        />
      ))}
    </div>
  ) : (
    <Empty text="No accepted procurement items are ready for installation." />
  );
}
