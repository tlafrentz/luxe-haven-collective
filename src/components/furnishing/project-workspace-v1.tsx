import Link from "next/link";
import {
  acceptRoomDesignAction,
  approveMoodBoardAction,
  changeSelectionOfferAction,
  createFurnishingPropertyAction,
  createPlanRevisionAction,
  createProjectWorkspaceAction,
  generateFurnishingPlanAction,
  getProjectSetup,
  listProjectWorkspaces,
  getProjectWorkspace,
  markExistingInventoryAction,
  overrideSelectionQuantityAction,
  replaceProjectSelectionAction,
  requestMoodBoardRevisionAction,
  requestRoomRevisionAction,
  submitOrApprovePlanAction,
  validateFurnishingPlanAction,
} from "@/app/actions/furnishing-project-workspace";
import { budgetStatus, planProgress } from "@/features/furnishing-studio";
import { Badge, FurnishingHeader } from "./furnishing-navigation";
import { createFs008dProjectSnapshot } from "@/app/actions/fs008d-governance";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const field =
    "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm",
  button =
    "inline-flex rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white",
  panel = "rounded-2xl border border-stone-200 bg-white p-5",
  money = (minor: unknown) =>
    typeof minor === "number"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(minor / 100)
      : "Price unavailable";
export async function NewProjectWorkspace({
  customer = false,
  selectedPropertyId,
}: {
  customer?: boolean;
  selectedPropertyId?: string;
}) {
  const data = await getProjectSetup();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      {customer ? (
        <header>
          <p className="text-xs font-bold uppercase text-violet-700">
            Furnishing Studio
          </p>
          <h1 className="mt-2 text-4xl font-semibold">
            New Furnishing Project
          </h1>
        </header>
      ) : (
        <FurnishingHeader
          title="New Furnishing Project"
          description="Create the property plan, rooms, package, design direction, and budget in one short setup."
          current="projects"
        />
      )}
      <form action={createProjectWorkspaceAction} className="space-y-5">
        <Step n="1" title="Property">
          <p className="mb-3 text-sm text-stone-600">
            Confirm the property this project furnishes. A material change
            here (bedroom or bathroom count) can affect which packages are
            eligible and their scope, so confirm details are accurate before
            continuing.
          </p>
          <select
            required
            name="propertyId"
            className={field}
            defaultValue={selectedPropertyId ?? ""}
          >
            <option value="">Select existing property</option>
            {data.properties.map((x: Row) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.city ?? ""} {x.state ?? ""}
              </option>
            ))}
          </select>
          {customer ? <Link href="/properties/new?returnTo=%2Fdashboard%2Ffurnishing%2Fprojects%2Fnew" className="mt-4 inline-flex rounded-xl border px-4 py-2.5 text-sm font-semibold text-violet-700">+ Add new canonical property</Link> : <details className="mt-4 rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold text-violet-700">
              + Add new canonical property
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select required name="workspaceId" className={field}>
                <option value="">Workspace</option>
                {data.workspaces.map((x: Row) => {
                  const id = x.workspace_id ?? x.id;
                  return (
                    <option value={id} key={id}>
                      {x.profiles?.full_name ?? x.profiles?.email ?? id}
                    </option>
                  );
                })}
              </select>
              <input
                required
                name="propertyName"
                className={field}
                placeholder="Property name"
              />
              <input
                required
                name="address"
                className={field}
                placeholder="Address"
              />
              <input
                required
                name="city"
                className={field}
                placeholder="City"
              />
              <input
                required
                name="state"
                className={field}
                placeholder="State / region"
              />
              <input
                required
                name="postalCode"
                className={field}
                placeholder="Postal code"
              />
              <input name="country" defaultValue="US" className={field} />
              <input
                required
                name="propertyType"
                defaultValue="short_term_rental"
                className={field}
              />
              <select
                name="timezone"
                className={field}
                defaultValue="America/Phoenix"
              >
                <option value="America/Phoenix">
                  Arizona Time (America/Phoenix)
                </option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/New_York">Eastern Time</option>
              </select>
              <input
                name="propertyBedrooms"
                type="number"
                min="0"
                className={field}
                placeholder="Bedrooms"
              />
              <input
                name="propertyBathrooms"
                type="number"
                min="0"
                step=".5"
                className={field}
                placeholder="Bathrooms"
              />
              <input
                name="propertyGuests"
                type="number"
                min="1"
                className={field}
                placeholder="Guest capacity"
              />
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="createAnyway" />
                Confirm creation if a matching address exists
              </label>
              <button
                formAction={createFurnishingPropertyAction}
                formNoValidate
                className={button}
              >
                Save property
              </button>
            </div>
          </details>}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label>
              Bedrooms
              <input
                name="bedrooms"
                type="number"
                min="0"
                className={`${field} mt-1`}
              />
            </label>
            <label>
              Bathrooms
              <input
                name="bathrooms"
                type="number"
                min="0"
                step=".5"
                className={`${field} mt-1`}
              />
            </label>
            <label>
              Guest capacity
              <input
                name="guests"
                type="number"
                min="1"
                className={`${field} mt-1`}
              />
            </label>
          </div>
        </Step>
        <Step n="2" title="Project">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              name="name"
              className={field}
              placeholder="Luxe Haven Mesa — Full Furnishing"
            />
            <select name="projectType" className={field}>
              <option value="full_property">Full property</option>
              <option value="partial_property">Partial property</option>
              <option>refresh</option>
              <option>replacement</option>
            </select>
            <input name="targetLaunchDate" type="date" className={field} />
            <select name="furnishingState" className={field}>
              <option value="empty">Empty</option>
              <option value="partially_furnished">Partially furnished</option>
              <option value="furnished">Furnished</option>
              <option value="refresh_needed">Refresh needed</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </Step>
        <Step n="3" title="Rooms">
          <p className="text-sm text-stone-600">
            Bedrooms and bathrooms generate editable canonical room instances.
            Living Room, Kitchen, and Dining Room are included. Package
            selection below determines exactly which rooms and quantities are
            covered — rooms beyond your package&apos;s limits stay editable
            here but will need an add-on or package upgrade to include in the
            design plan.
          </p>
          <label className="mt-3 flex gap-2">
            <input type="checkbox" name="includeOutdoor" />
            Include Outdoor
          </label>
        </Step>
        <Step n="4" title="Package">
          <p className="mb-3 text-sm text-stone-600">
            This confirms the approved package version for your project.
            Changing packages after design work has started requires an
            order adjustment — it is not a free, direct edit.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.packages.map((x: Row) => (
              <label className="rounded-xl border p-4" key={x.id}>
                <input
                  required
                  type="radio"
                  name="packageVersionId"
                  value={x.id}
                />
                <strong className="ml-2">{x.furnishing_packages?.name}</strong>
                <p className="mt-2 text-sm text-stone-500">
                  v{x.version_number} · {money(x.estimated_budget_low_minor)}–
                  {money(x.estimated_budget_high_minor)}
                </p>
              </label>
            ))}
          </div>
        </Step>
        <Step n="5" title="Design">
          <div className="grid gap-3 md:grid-cols-3">
            {data.styles.map((x: Row) => (
              <label className="rounded-xl border p-4" key={x.id}>
                <input
                  required
                  type="radio"
                  name="styleVersionId"
                  value={x.id}
                />
                <strong className="ml-2">
                  {x.furnishing_style_systems?.name}
                </strong>
                <p className="mt-2 text-sm text-stone-500">
                  {x.mood_tags?.join(" · ")}
                </p>
              </label>
            ))}
          </div>
          <select name="tier" className={`${field} mt-3 max-w-sm`}>
            <option>essential</option>
            <option>elevated</option>
            <option>luxury</option>
            <option>custom</option>
          </select>
        </Step>
        <Step n="6" title="Budget">
          <p className="mb-3 text-sm text-stone-600">
            This is your target <strong>furnishing budget</strong> — what you
            expect to spend on the actual furniture and décor. It is separate
            from the design and project-management service fee you already
            paid, and it is a planning target only: the real, itemized
            estimate is generated in the next step and nothing is purchased
            until you approve it.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              name="targetBudget"
              inputMode="decimal"
              className={field}
              placeholder="Target furnishing budget"
            />
            <select name="budgetPriority" className={field}>
              <option value="stay_under_budget">Stay under budget</option>
              <option value="balanced">Balanced</option>
              <option value="prioritize_design">Prioritize design</option>
            </select>
          </div>
        </Step>
        <Step n="7" title="Generate">
          <p className="text-sm text-stone-600">
            Create the project and detected rooms. We&apos;ll immediately
            generate a draft Plan v1 estimate from your approved package and
            style versions for you to review — nothing is purchased until you
            approve it.
          </p>
          <button className={`${button} mt-4`}>Create project workspace</button>
        </Step>
      </form>
    </main>
  );
}
function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={panel}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-700 text-sm font-bold text-white">
          {n}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
export async function CustomerProjectList({
  customer = true,
}: {
  customer?: boolean;
} = {}) {
  const projects = (await listProjectWorkspaces()) as Row[];
  const base = customer ? "/dashboard/furnishing/projects" : "/admin/furnishing/projects";
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
            Furnishing Studio
          </p>
          <h1 className="mt-2 text-4xl font-semibold">Projects</h1>
          <p className="mt-2 text-stone-600">
            Plan, design, and approve property furnishing plans.
          </p>
        </div>
        <Link href={`${base}/new`} className={button}>
          + New furnishing project
        </Link>
      </header>
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                {[
                  "Project",
                  "Property",
                  "Type",
                  "Lifecycle",
                  "Plan",
                  "Estimate",
                  "Target launch",
                  "Next action",
                ].map((x) => (
                  <th className="p-4" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const plan =
                  project.furnishing_plans?.find(
                    (x: Row) => x.status !== "superseded",
                  ) ?? project.furnishing_plans?.at(-1);
                return (
                  <tr className="border-t" key={project.id}>
                    <td className="p-4 font-semibold">{project.name}</td>
                    <td>{project.properties?.name}</td>
                    <td className="capitalize">
                      {project.project_type?.replaceAll("_", " ")}
                    </td>
                    <td>
                      <Badge value={project.lifecycle_status} />
                    </td>
                    <td>
                      <Badge value={project.plan_status} />
                    </td>
                    <td>{money(plan?.estimated_total_minor)}</td>
                    <td>{project.target_launch_date ?? "Not set"}</td>
                    <td>
                      <Link
                        className="font-semibold text-violet-700"
                        href={`${base}/${project.id}`}
                      >
                        Continue planning
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!projects.length ? (
          <div className="p-12 text-center">
            <h2 className="text-xl font-semibold">
              Create your first furnishing project.
            </h2>
            <p className="mt-2 text-stone-600">
              Use approved packages and styles to generate a room-by-room plan.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
export async function ProjectWorkspace({
  projectId,
  roomId,
  customer = false,
}: {
  projectId: string;
  roomId?: string;
  customer?: boolean;
}) {
  const { project, packageVersion, products, validations, notes, moodBoards } =
      (await getProjectWorkspace(projectId)) as Row,
    plans: Row[] = project.furnishing_plans ?? [],
    plan =
      plans.find((x) => x.id === project.current_plan_version_id) ??
      plans.at(-1),
    rooms: Row[] = project.furnishing_rooms ?? [],
    selectedRoom = rooms.find((x) => x.id === roomId) ?? rooms[0],
    roomNotes: Row[] = (notes ?? []).filter(
      (x: Row) => x.room_id === selectedRoom?.id,
    ),
    selections: Row[] = plan?.furnishing_product_selections ?? [],
    roomSelections = selections.filter((x) => x.room_id === selectedRoom?.id),
    target = project.target_budget_minor,
    estimated = Number(plan?.estimated_total_minor ?? 0),
    budget =
      target === null ? "not_set" : budgetStatus(estimated, Number(target)),
    progress = planProgress(
      selections.map((x) => ({
        id: x.id,
        roomId: x.room_id,
        required: x.required,
        productId: x.product_id,
        resolvedQuantity: Number(x.resolved_quantity),
        existingQuantity: Number(x.existing_quantity),
        unitPriceMinor: x.estimated_unit_price_minor,
        selectionStatus: x.selection_status,
      })),
      selections.filter((x) => x.required).length,
    ),
    validation = validations[0];
  const missingSetup = [
    !project.furnishing_package_version_id ? "approved package" : null,
    !rooms.length ? "canonical rooms" : null,
    target === null ? "target budget" : null,
  ].filter((value): value is string => Boolean(value));
  const canGeneratePlan = !plan && missingSetup.length === 0;
  const base = customer
    ? `/dashboard/furnishing/projects/${projectId}`
    : `/admin/furnishing/projects/${projectId}`;
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <Link
            href={
              customer
                ? "/dashboard/furnishing/projects"
                : "/admin/furnishing/projects"
            }
            className="text-sm font-semibold text-violet-700"
          >
            ← Projects
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-stone-500">
            {project.properties?.name} · Plan v{plan?.version_number ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {plan?.status === "approved" ? (
            <Link
              href={`${base}/procurement`}
              className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Start procurement
            </Link>
          ) : null}
          <Badge value={project.lifecycle_status} />
          <span className="font-semibold">
            {money(estimated)} / {money(target)}
          </span>
          {plan ? (
            <form action={validateFurnishingPlanAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="planId" value={plan.id} />
              <button className="rounded-xl border px-4 py-2 text-sm font-semibold">
                Review plan
              </button>
            </form>
          ) : canGeneratePlan ? (
            <form action={generateFurnishingPlanAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <button className={button}>Generate Plan v1</button>
            </form>
          ) : null}
        </div>
      </header>
      {!plan && canGeneratePlan ? (
        <section className="mx-auto mt-12 max-w-2xl rounded-2xl border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold">
            Ready to generate the furnishing plan
          </h2>
          <p className="mt-3 text-stone-600">
            {rooms.length} rooms · {packageVersion?.furnishing_packages?.name} ·
            exact approved package and design versions will be snapshotted.
          </p>
        </section>
      ) : !plan ? (
        <section
          className="mx-auto mt-12 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8"
          role="status"
        >
          <h2 className="text-2xl font-semibold text-amber-950">
            Project setup is incomplete
          </h2>
          <p className="mt-3 text-amber-900">
            This project cannot generate a furnishing plan until its missing
            setup is reconciled by an Admin.
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-950">
            Missing: {missingSetup.join(", ")}.
          </p>
          <Link
            href={customer ? "/dashboard/furnishing/projects" : "/admin/furnishing/projects"}
            className="mt-6 inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950"
          >
            Return to projects
          </Link>
        </section>
      ) : (
        <div className="mt-5 grid min-h-[720px] gap-5 lg:grid-cols-[240px_1fr_300px]">
          <aside className={panel}>
            <h2 className="font-semibold">Rooms</h2>
            <Link
              href={base}
              className="mt-3 block rounded-lg p-2 text-sm font-semibold"
            >
              Overview
            </Link>
            <nav className="mt-2 space-y-1">
              {rooms.map((room) => {
                const items = selections.filter((x) => x.room_id === room.id),
                  attention = items.some(
                    (x) =>
                      x.required &&
                      (!x.product_id || x.estimated_unit_price_minor === null),
                  );
                return (
                  <Link
                    href={`${base}?room=${room.id}`}
                    key={room.id}
                    className={`flex items-center justify-between rounded-lg p-2 text-sm ${selectedRoom?.id === room.id ? "bg-violet-50 font-semibold text-violet-800" : ""}`}
                  >
                    <span>
                      {room.name}
                      <span className="ml-1.5 text-xs font-normal text-stone-400">
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span aria-label={attention ? "Needs attention" : "Ready"}>
                      {attention ? "!" : "✓"}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </aside>
          <section className="space-y-4">
            <div className={panel}>
              <div className="flex justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {selectedRoom?.name}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {roomSelections.length} requirements ·{" "}
                    {money(
                      roomSelections.reduce(
                        (n, x) => n + Number(x.estimated_total_minor ?? 0),
                        0,
                      ),
                    )}
                  </p>
                </div>
                <Badge value={selectedRoom?.status ?? "not_started"} />
              </div>
              {selectedRoom ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
                  <form action={acceptRoomDesignAction}>
                    <input type="hidden" name="roomId" value={selectedRoom.id} />
                    <button
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={selectedRoom.status === "approved"}
                    >
                      {selectedRoom.status === "approved"
                        ? "Room design accepted"
                        : "Accept room design"}
                    </button>
                  </form>
                  <details className="flex-1">
                    <summary className="cursor-pointer text-sm font-semibold text-amber-700">
                      Request a revision
                    </summary>
                    <form
                      action={requestRoomRevisionAction}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      <input
                        type="hidden"
                        name="roomId"
                        value={selectedRoom.id}
                      />
                      <input
                        required
                        name="notes"
                        placeholder="What would you like changed?"
                        className={`${field} flex-1`}
                      />
                      <button className="rounded-lg border px-4 py-2 text-sm font-semibold">
                        Submit request
                      </button>
                    </form>
                  </details>
                </div>
              ) : null}
              {roomNotes.length ? (
                <ul className="mt-4 space-y-2 border-t pt-4 text-xs text-stone-500">
                  {roomNotes.map((note) => (
                    <li key={note.id}>
                      {note.body} ·{" "}
                      {new Date(note.created_at).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="space-y-3">
              {roomSelections.map((selection) => (
                <SelectionCard
                  key={selection.id}
                  selection={selection}
                  products={products}
                />
              ))}
            </div>
          </section>
          <aside className="space-y-4">
            <section className={panel}>
              <h2 className="font-semibold">Project budget</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt>Target</dt>
                  <dd>{money(target)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Estimated</dt>
                  <dd>{money(estimated)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Remaining</dt>
                  <dd>
                    {money(target === null ? null : Number(target) - estimated)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 capitalize font-semibold">
                {budget.replaceAll("_", " ")}
              </p>
            </section>
            <section className={panel}>
              <h2 className="font-semibold">Plan health</h2>
              <p className="mt-3 text-3xl font-semibold">{progress.percent}%</p>
              <p className="text-sm text-stone-500">
                {progress.resolved}/{progress.requiredCount} required selections
                resolved
              </p>
              {validation ? (
                <div className="mt-4 text-sm">
                  <p className="text-red-700">
                    {validation.errors?.length ?? 0} errors
                  </p>
                  <p className="text-amber-700">
                    {validation.warnings?.length ?? 0} warnings
                  </p>
                </div>
              ) : null}
            </section>
            <PlanActions
              project={project}
              plan={plan}
              validation={validation}
            />
          </aside>
        </div>
      )}
      <section className={`${panel} mt-5`}>
        <h2 className="text-xl font-semibold">Mood board</h2>
        {!moodBoards?.length ? (
          <p className="mt-3 text-sm text-stone-500">
            No mood board yet. Your designer will publish one here for you to
            review once the room design direction is ready.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {moodBoards.map((board: Row) => {
              const items: Row[] = board.furnishing_mood_board_items ?? [];
              return (
                <div key={board.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{board.name}</h3>
                      <p className="text-xs text-stone-500">
                        Design version snapshot · updated{" "}
                        {new Date(board.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge value={board.status} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {items
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border p-3 text-sm"
                        >
                          {item.item_type === "product" ? (
                            <p className="font-medium">
                              {item.furnishing_products?.name ?? "Product"}
                            </p>
                          ) : item.item_type === "design_token" ? (
                            <div className="flex items-center gap-2">
                              {item.furnishing_design_tokens?.token_type ===
                              "color" ? (
                                <span
                                  className="size-5 shrink-0 rounded-full border"
                                  style={{
                                    backgroundColor:
                                      item.furnishing_design_tokens?.value,
                                  }}
                                />
                              ) : null}
                              <span>
                                {item.furnishing_design_tokens?.name ?? "Token"}
                              </span>
                            </div>
                          ) : item.item_type === "text" ? (
                            <p>{item.text}</p>
                          ) : (
                            <p className="text-stone-500">Media item</p>
                          )}
                        </div>
                      ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <form action={approveMoodBoardAction}>
                      <input type="hidden" name="moodBoardId" value={board.id} />
                      <button
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        disabled={board.status === "approved"}
                      >
                        {board.status === "approved"
                          ? "Approved"
                          : "Approve mood board"}
                      </button>
                    </form>
                    <details className="flex-1">
                      <summary className="cursor-pointer text-sm font-semibold text-amber-700">
                        Request a revision
                      </summary>
                      <form
                        action={requestMoodBoardRevisionAction}
                        className="mt-3 flex flex-wrap gap-2"
                      >
                        <input
                          type="hidden"
                          name="moodBoardId"
                          value={board.id}
                        />
                        <input
                          required
                          name="notes"
                          placeholder="What would you like changed?"
                          className={`${field} flex-1`}
                        />
                        <button className="rounded-lg border px-4 py-2 text-sm font-semibold">
                          Submit request
                        </button>
                      </form>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
function SelectionCard({
  selection,
  products,
}: {
  selection: Row;
  products: Row[];
}) {
  const offers: Row[] =
    selection.furnishing_products?.furnishing_product_offers ?? [];
  return (
    <article className={panel}>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            {selection.requirement_name}
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            {selection.furnishing_products?.name ?? "Needs selection"}
          </h3>
          <p className="text-sm text-stone-500">
            Qty {selection.quantity_override ?? selection.resolved_quantity} ·
            Buy {selection.purchase_quantity} ·{" "}
            {money(selection.estimated_total_minor)}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {selection.price_observed_at
              ? `Price checked ${new Date(selection.price_observed_at).toLocaleDateString()}`
              : "Price not yet checked"}
          </p>
        </div>
        <div className="text-right">
          <Badge value={selection.selection_status} />
          <p className="mt-2 text-xs capitalize">
            Style: {selection.style_compatibility ?? "unclassified"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-violet-700">
            Replace product
          </summary>
          <form
            action={replaceProjectSelectionAction}
            className="mt-3 grid gap-2 sm:grid-cols-3"
          >
            <input type="hidden" name="selectionId" value={selection.id} />
            <input
              type="hidden"
              name="expectedRevision"
              value={selection.revision}
            />
            <select required name="productId" className={field}>
              <option value="">Product</option>
              {products.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select name="exceptionReason" className={field}>
              <option value="">Exception reason if unclassified/avoid</option>
              <option value="budget">Budget</option>
              <option value="availability">Availability</option>
              <option value="customer_preference">Customer preference</option>
              <option value="existing_inventory">Existing inventory</option>
              <option value="intentional_contrast">Intentional contrast</option>
              <option value="other">Other</option>
            </select>
            <button className={button}>Use product</button>
          </form>
        </details>
        {offers.length > 1 ? (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-violet-700">
              Change retailer offer
            </summary>
            <form
              action={changeSelectionOfferAction}
              className="mt-3 flex gap-2"
            >
              <input type="hidden" name="selectionId" value={selection.id} />
              <input
                type="hidden"
                name="expectedRevision"
                value={selection.revision}
              />
              <select required name="offerId" className={field}>
                {offers.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.furnishing_retailers?.name} ·{" "}
                    {money(o.listed_price_minor)}
                  </option>
                ))}
              </select>
              <button className={button}>Use offer</button>
            </form>
          </details>
        ) : null}
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-violet-700">
            Use existing item
          </summary>
          <form
            action={markExistingInventoryAction}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input type="hidden" name="selectionId" value={selection.id} />
            <input
              type="hidden"
              name="expectedRevision"
              value={selection.revision}
            />
            <input
              required
              name="quantity"
              type="number"
              min="0"
              step="1"
              className={field}
              placeholder="Existing qty"
            />
            <select name="condition" className={field}>
              <option>excellent</option>
              <option>good</option>
              <option>fair</option>
              <option>poor</option>
              <option>unknown</option>
            </select>
            <input name="notes" className={field} placeholder="Notes" />
            <button className={button}>Record</button>
          </form>
        </details>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-violet-700">
            Override quantity
          </summary>
          <form
            action={overrideSelectionQuantityAction}
            className="mt-3 flex flex-wrap gap-2"
          >
            <input type="hidden" name="selectionId" value={selection.id} />
            <input
              type="hidden"
              name="expectedRevision"
              value={selection.revision}
            />
            <input
              required
              name="quantity"
              type="number"
              min="0"
              className={field}
            />
            <input
              required
              name="reason"
              className={field}
              placeholder="Reason required"
            />
            <button className={button}>Apply</button>
          </form>
        </details>
      </div>
    </article>
  );
}
function PlanActions({
  project,
  plan,
  validation,
}: {
  project: Row;
  plan: Row;
  validation?: Row;
}) {
  return (
    <section className={panel}>
      <h2 className="font-semibold">Approval</h2>
      {plan.status === "draft" ? (
        <form action={submitOrApprovePlanAction} className="mt-3">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="planId" value={plan.id} />
          <input type="hidden" name="mode" value="submit" />
          <button
            disabled={!validation || validation.errors?.length}
            className={`${button} w-full justify-center disabled:opacity-40`}
          >
            Submit for approval
          </button>
        </form>
      ) : null}
      {plan.status === "awaiting_approval" ? (
        <form action={submitOrApprovePlanAction} className="mt-3">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="planId" value={plan.id} />
          <input type="hidden" name="mode" value="approve" />
          <button className={`${button} w-full justify-center`}>
            Approve Plan v{plan.version_number}
          </button>
        </form>
      ) : null}
      {plan.status === "approved" ? (
        <form action={async () => { "use server"; if (!project.furnishing_package_version_id) throw new Error("PACKAGE_VERSION_REQUIRED"); await createFs008dProjectSnapshot({ projectId: project.id, packageVersionId: project.furnishing_package_version_id, snapshot: { planId: plan.id }, contentHash: `plan:${plan.id}:v${plan.version_number}`, correlationId: `fs008d-snapshot:${project.id}`, idempotencyKey: `fs008d-snapshot:${project.id}:v${plan.version_number}` }); }} className="mt-3">
          <button className={`${button} w-full justify-center`}>Save immutable catalog snapshot</button>
        </form>
      ) : null}
      {plan.status === "approved" ? (
        <form action={createPlanRevisionAction} className="mt-3">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="planId" value={plan.id} />
          <button className={`${button} w-full justify-center`}>
            Create Plan v{plan.version_number + 1}
          </button>
        </form>
      ) : null}
      <p className="mt-3 text-xs text-stone-500">
        Approved plans are immutable and ready for procurement.
      </p>
    </section>
  );
}
