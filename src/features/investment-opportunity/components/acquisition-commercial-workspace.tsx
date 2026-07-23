import { AlertTriangle, ArrowDown, Check, GitBranch, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type {
  AcquisitionCommercialWorkspaceSummary,
  AcquisitionOfferHeadlineTerms,
  AcquisitionWorkspaceNextAction,
  InvestmentAnalysisWorkspaceSummary,
  InvestmentOpportunityWorkspaceSummary,
} from "../acquisition-workspace";
import { AcquisitionPrimaryAction } from "./acquisition-primary-action";

type CommercialState = "empty" | "draft" | "submitted" | "countered" | "accepted" | "contracted" | "rejected" | "expired" | "withdrawn";
type CommercialHealth = "healthy" | "attention" | "expired" | "blocked";

export function isCommercialActionType(type: AcquisitionWorkspaceNextAction["type"]) {
  return ["create-offer", "edit-offer", "submit-offer", "record-response", "record-contract"].includes(type);
}

export function AcquisitionCommercialWorkspace({
  commercial,
  opportunity,
  analysis,
  primaryAction,
}: {
  commercial: AcquisitionCommercialWorkspaceSummary;
  opportunity: InvestmentOpportunityWorkspaceSummary;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
  primaryAction: AcquisitionWorkspaceNextAction | null;
}) {
  const state = resolveCommercialState(commercial);
  const health = resolveCommercialHealth(commercial, analysis);
  const events = buildCommercialTimeline(commercial);
  const deltas = buildCommercialDeltas(commercial.currentOffer?.headlineTerms ?? null, commercial.latestResponse?.headlineTerms ?? null);
  const guidance = commercialGuidance(state);

  return <section aria-labelledby="commercial-workspace-heading" className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">Commercial workspace</p><h2 id="commercial-workspace-heading" className="mt-2 font-serif text-3xl text-stone-950 sm:text-4xl">Negotiation</h2></div>
      <div className="flex flex-wrap items-center gap-2"><Badge tone={commercialHealthTone(health)}>{commercialHealthLabel(health)}</Badge><Badge>{commercialStateLabel(state)}</Badge></div>
    </div>

    {state === "empty"
      ? <CommercialEmptyState primaryAction={primaryAction} opportunity={opportunity} analysis={analysis} />
      : <>
        <CurrentPositionCard commercial={commercial} state={state} />
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <CurrentOfferCard commercial={commercial} />
          <InvestmentAlignmentCard commercial={commercial} analysis={analysis} />
        </div>
        <NegotiationTimeline events={events} />
        {commercial.latestResponse?.type === "countered" && commercial.latestResponse.headlineTerms
          ? <div className="grid gap-5 xl:grid-cols-2"><OfferComparison commercial={commercial} /><CommercialDelta deltas={deltas} /></div>
          : null}
        <div className="grid gap-5 xl:grid-cols-2">
          <AcceptedAgreementCard commercial={commercial} />
          <CommercialGuidanceCard guidance={guidance} />
        </div>
        <OfferHistoryCard commercial={commercial} />
        {primaryAction ? <AcquisitionPrimaryAction action={primaryAction} opportunity={opportunity} analysis={analysis} /> : null}
      </>}
  </section>;
}

function CurrentPositionCard({ commercial, state }: { commercial: AcquisitionCommercialWorkspaceSummary; state: CommercialState }) {
  const offer = commercial.currentOffer;
  return <Card className="border-stone-800 bg-stone-950 p-5 text-white sm:p-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Current position</p><h3 className="mt-2 text-2xl font-semibold">{commercialStateLabel(state)}</h3><p className="mt-1 text-sm text-stone-300">{positionDescription(state)}</p></div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
        <PositionFact term="Current offer" value={offer ? `#${offer.sequence}` : "None"} />
        <PositionFact term="Submitted" value={offer?.submittedAt ? formatDate(offer.submittedAt) : "Not submitted"} />
        <PositionFact term="Expiration" value={offer?.expiresAt ? formatDate(offer.expiresAt) : "No expiration"} />
      </dl>
    </div>
    {offer?.status === "expired" ? <div role="alert" className="mt-5 flex gap-3 rounded-xl bg-rose-950 p-4 text-rose-100"><Timer className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Offer expired</p><p className="mt-1 text-sm text-rose-200">This offer is inactive. Follow the projected next action before continuing negotiation.</p></div></div> : null}
  </Card>;
}

export function CurrentOfferCard({ commercial }: { commercial: AcquisitionCommercialWorkspaceSummary }) {
  const offer = commercial.currentOffer;
  if (!offer) return <CommercialPanel title="Current offer" description="The active commercial proposal."><EmptyCopy title="No active offer" body="Prepare an offer to establish the current commercial position." /></CommercialPanel>;
  return <CommercialPanel title={`Current offer #${offer.sequence}`} description="Headline terms only; detailed conditions remain in the offer workflow.">
    <div className="flex flex-wrap items-center gap-2"><Badge tone={offer.status === "expired" ? "danger" : offer.editable ? "warning" : "success"}>{title(offer.status)}</Badge><Badge>{offer.route === "purchase" ? "Purchase" : "Rental arbitrage"}</Badge>{offer.current ? <Badge tone="dark">Current</Badge> : null}</div>
    <HeadlineTerms terms={offer.headlineTerms} />
    <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5">
      <SmallFact term="Created" value={formatDate(offer.createdAt)} />
      <SmallFact term="Submitted" value={offer.submittedAt ? formatDate(offer.submittedAt) : "Not submitted"} />
      <SmallFact term="Expires" value={offer.expiresAt ? formatDate(offer.expiresAt) : "No expiration"} />
      <SmallFact term="Analysis basis" value={`Version ${offer.sourceAnalysis.version}`} />
    </dl>
  </CommercialPanel>;
}

function InvestmentAlignmentCard({ commercial, analysis }: { commercial: AcquisitionCommercialWorkspaceSummary; analysis: InvestmentAnalysisWorkspaceSummary | null }) {
  const alignment = commercial.analysisAlignment;
  const tone = alignment?.status === "aligned" ? "success" : alignment?.status === "changed" ? "warning" : "neutral";
  return <CommercialPanel title="Investment alignment" description="Whether the active commercial position remains consistent with its approved analysis basis.">
    <div className="flex flex-wrap items-center gap-2"><Badge tone={tone}>{alignment ? alignment.status === "aligned" ? "Within investment thesis" : title(alignment.status) : "Alignment unavailable"}</Badge>{analysis?.stale ? <Badge tone="warning">Analysis stale</Badge> : null}</div>
    {alignment?.differences.length ? <ul className="mt-5 space-y-2">{alignment.differences.map((difference, index) => <li key={`${difference}-${index}`} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{difference}</span></li>)}</ul>
      : alignment?.status === "aligned" ? <p className="mt-5 text-sm leading-6 text-stone-600">No commercial differences from the recorded analysis basis were projected.</p>
        : <p className="mt-5 text-sm leading-6 text-stone-600">A return-impact calculation is not available in this bounded workspace projection. Review the linked analysis before accepting changed terms.</p>}
    {commercial.currentOffer ? <div className="mt-5 border-t border-stone-100 pt-4"><p className="eyebrow">Commercial lineage</p><p className="mt-2 text-sm text-stone-700">Offer #{commercial.currentOffer.sequence} → Analysis version {commercial.currentOffer.sourceAnalysis.version}</p><p className="mt-1 text-xs text-stone-500">Analysis {commercial.currentOffer.sourceAnalysis.analysisId}</p></div> : null}
  </CommercialPanel>;
}

function NegotiationTimeline({ events }: { events: readonly CommercialTimelineEvent[] }) {
  return <CommercialPanel title="Negotiation timeline" description="Chronological commercial events with immutable source references.">
    {events.length ? <ol className="relative space-y-0" aria-label="Commercial negotiation timeline">{events.map((event, index) => <li key={event.id} className="relative grid grid-cols-[1.5rem_1fr] gap-3 pb-6 last:pb-0">
      {index < events.length - 1 ? <span className="absolute bottom-0 left-[0.7rem] top-5 w-px bg-stone-200" aria-hidden="true" /> : null}
      <span className={["relative z-10 mt-1 h-3 w-3 rounded-full ring-4 ring-white", event.terminal ? "bg-stone-900" : "bg-teal-700"].join(" ")} aria-hidden="true" />
      <div><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-stone-900">{event.label}</p><time dateTime={event.occurredAt.toISOString()} className="text-xs text-stone-500">{formatDateTime(event.occurredAt)}</time></div><p className="mt-1 text-sm text-stone-600">{event.detail}</p><p className="mt-1 text-xs text-stone-500">{event.actor}</p></div>
    </li>)}</ol> : <EmptyCopy title="No negotiation activity" body="Commercial events will appear after the first offer is prepared." />}
  </CommercialPanel>;
}

function OfferComparison({ commercial }: { commercial: AcquisitionCommercialWorkspaceSummary }) {
  const offer = commercial.currentOffer;
  const counter = commercial.latestResponse?.headlineTerms;
  if (!offer || !counter) return null;
  const rows = comparisonRows(offer.headlineTerms, counter);
  return <CommercialPanel title="Counteroffer comparison" description="Your current offer compared field by field with the latest counter.">
    <div role="table" aria-label="Offer and counteroffer comparison" className="overflow-hidden rounded-xl border border-stone-200">
      <div role="row" className="grid grid-cols-3 bg-stone-50 p-3 text-xs font-semibold uppercase tracking-wide text-stone-500"><span role="columnheader">Term</span><span role="columnheader">You</span><span role="columnheader">Counter</span></div>
      {rows.map(row => <div role="row" key={row.label} className={["grid grid-cols-3 gap-2 border-t border-stone-100 p-3 text-sm", row.changed ? "bg-amber-50" : "bg-white"].join(" ")}><span role="cell" className="font-medium text-stone-800">{row.label}</span><span role="cell" className="text-stone-600">{row.current}</span><span role="cell" className={row.changed ? "font-semibold text-amber-900" : "text-stone-600"}>{row.counter}</span></div>)}
    </div>
  </CommercialPanel>;
}

function CommercialDelta({ deltas }: { deltas: readonly CommercialDeltaItem[] }) {
  return <CommercialPanel title="Counteroffer changes" description="Only headline terms that changed in the latest counteroffer.">
    {deltas.length ? <dl className="space-y-3">{deltas.map(delta => <div key={delta.label} className="flex flex-col gap-1 rounded-xl bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><dt className="text-sm font-medium text-amber-950">{delta.label}</dt><dd className="text-sm font-semibold text-amber-900">{delta.delta}</dd></div>)}</dl> : <EmptyCopy title="No headline changes" body="The projected headline terms match the current offer. Detailed conditions are outside this summary." />}
  </CommercialPanel>;
}

function AcceptedAgreementCard({ commercial }: { commercial: AcquisitionCommercialWorkspaceSummary }) {
  const agreement = commercial.acceptedAgreement;
  const contract = commercial.contract;
  return <CommercialPanel title="Agreement status" description="Acceptance and contract execution are intentionally distinct.">
    {agreement ? <div className="rounded-xl bg-emerald-50 p-4"><div className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-700" aria-hidden="true" /><p className="font-semibold text-emerald-950">Accepted {formatDate(agreement.acceptedAt)}</p></div><dl className="mt-4 grid grid-cols-2 gap-4"><SmallFact term="Based on" value={agreement.source === "counteroffer" ? `Counter ${agreement.responseId ?? ""}` : agreement.source === "offer" ? `Offer ${agreement.offerId ?? ""}` : "External agreement"} /><SmallFact term="Waiting on" value={contract ? "Nothing — contract recorded" : "Contract execution"} /></dl></div>
      : <EmptyCopy title="No accepted agreement" body="An accepted offer, accepted counteroffer, or external agreement has not been recorded." />}
    {contract ? <div className="mt-4 rounded-xl border border-stone-200 p-4"><p className="eyebrow">Executed contract</p><p className="mt-2 text-sm font-semibold text-stone-900">{title(contract.source)} · effective {formatDate(contract.effectiveDate)}</p><p className="mt-1 text-xs text-stone-500">Contract {contract.id}</p></div> : null}
  </CommercialPanel>;
}

function OfferHistoryCard({ commercial }: { commercial: AcquisitionCommercialWorkspaceSummary }) {
  const offers = [...commercial.priorOffers].sort((a, b) => a.sequence - b.sequence);
  return <CommercialPanel title="Offer history" description="A bounded, immutable record ordered by offer sequence.">
    {offers.length ? <ol className="flex flex-col gap-2">{offers.map((offer, index) => <li key={offer.id} className="flex items-center gap-3"><div className="min-w-0 flex-1 rounded-xl border border-stone-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-stone-900">Offer #{offer.sequence}</p><Badge>{title(offer.status)}</Badge></div><p className="mt-1 text-xs text-stone-500">{formatDate(offer.submittedAt ?? offer.createdAt)} · read-only</p></div>{index < offers.length - 1 ? <ArrowDown className="hidden h-4 w-4 text-stone-400 sm:block" aria-hidden="true" /> : null}</li>)}</ol>
      : <EmptyCopy title="No prior offers" body="Superseded and terminal offers will remain here as negotiation history." />}
    {commercial.priorOffersTruncated ? <p className="mt-4 text-xs text-stone-500">Showing {commercial.priorOffers.length} of {commercial.priorOfferTotalCount} prior offers.</p> : null}
  </CommercialPanel>;
}

function CommercialGuidanceCard({ guidance }: { guidance: Readonly<{ purpose: string; watchFor: string; nextObjective: string }> }) {
  return <CommercialPanel title="Commercial guidance" description="Product guidance for the current negotiation state.">
    <dl className="space-y-4"><GuidanceFact term="Purpose" value={guidance.purpose} /><GuidanceFact term="Watch for" value={guidance.watchFor} /><GuidanceFact term="Next objective" value={guidance.nextObjective} /></dl>
  </CommercialPanel>;
}

function CommercialEmptyState({ primaryAction, opportunity, analysis }: {
  primaryAction: AcquisitionWorkspaceNextAction | null;
  opportunity: InvestmentOpportunityWorkspaceSummary;
  analysis: InvestmentAnalysisWorkspaceSummary | null;
}) {
  return <Card className="border-dashed p-6 sm:p-8"><div className="mx-auto max-w-2xl text-center"><GitBranch className="mx-auto h-8 w-8 text-stone-500" aria-hidden="true" /><h3 className="mt-4 text-xl font-semibold text-stone-950">No offer has been prepared</h3><p className="mt-2 text-sm leading-6 text-stone-600">Create the first offer to establish commercial terms and preserve lineage to the investment analysis.</p></div>{primaryAction ? <div className="mt-6"><AcquisitionPrimaryAction action={primaryAction} opportunity={opportunity} analysis={analysis} /></div> : null}</Card>;
}

type CommercialTimelineEvent = Readonly<{ id: string; label: string; detail: string; actor: string; occurredAt: Date; terminal: boolean }>;
export function buildCommercialTimeline(commercial: AcquisitionCommercialWorkspaceSummary): readonly CommercialTimelineEvent[] {
  const events: CommercialTimelineEvent[] = [];
  for (const offer of [...commercial.priorOffers].sort((a, b) => a.sequence - b.sequence)) {
    events.push({ id: `offer-${offer.id}`, label: `Offer #${offer.sequence} ${title(offer.status)}`, detail: "Historical offer retained as an immutable commercial reference.", actor: "Operator", occurredAt: offer.submittedAt ?? offer.createdAt, terminal: ["rejected", "expired", "withdrawn"].includes(offer.status) });
  }
  const current = commercial.currentOffer;
  if (current) {
    events.push({ id: `offer-${current.id}-draft`, label: `Offer #${current.sequence} drafted`, detail: headlineSummary(current.headlineTerms), actor: "Operator", occurredAt: current.createdAt, terminal: false });
    if (current.submittedAt) events.push({ id: `offer-${current.id}-submitted`, label: `Offer #${current.sequence} submitted`, detail: headlineSummary(current.headlineTerms), actor: "Operator", occurredAt: current.submittedAt, terminal: false });
  }
  const response = commercial.latestResponse;
  if (response) events.push({ id: `response-${response.id}`, label: response.type === "countered" ? "Counterparty countered" : response.type === "accepted" ? "Counterparty accepted" : "Counterparty rejected", detail: response.headlineTerms ? headlineSummary(response.headlineTerms) : response.explanation ?? "Response recorded.", actor: title(response.counterpartyType), occurredAt: response.respondedAt, terminal: response.type !== "countered" });
  if (commercial.acceptedAgreement) events.push({ id: `agreement-${commercial.acceptedAgreement.responseId ?? commercial.acceptedAgreement.offerId ?? "external"}`, label: "Agreement accepted", detail: `Based on ${title(commercial.acceptedAgreement.source)}.`, actor: "Commercial lineage", occurredAt: commercial.acceptedAgreement.acceptedAt, terminal: false });
  if (commercial.contract) events.push({ id: `contract-${commercial.contract.id}`, label: "Contract recorded", detail: `Effective ${formatDate(commercial.contract.effectiveDate)}.`, actor: "Operator", occurredAt: commercial.contract.recordedAt, terminal: true });
  return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id));
}

type CommercialDeltaItem = Readonly<{ label: string; delta: string }>;
export function buildCommercialDeltas(current: AcquisitionOfferHeadlineTerms | null, counter: AcquisitionOfferHeadlineTerms | null): readonly CommercialDeltaItem[] {
  if (!current || !counter || current.route !== counter.route) return [];
  if (current.route === "purchase" && counter.route === "purchase") {
    const deltas: CommercialDeltaItem[] = [];
    const price = counter.offerPrice.amount - current.offerPrice.amount;
    if (price) deltas.push({ label: "Offer price", delta: signedCurrency(price) });
    const closing = dayDelta(current.proposedClosingDate, counter.proposedClosingDate);
    if (closing) deltas.push({ label: "Proposed closing", delta: signedDays(closing) });
    if (current.financingType !== counter.financingType) deltas.push({ label: "Financing", delta: `${title(current.financingType)} → ${title(counter.financingType)}` });
    return deltas;
  }
  if (current.route === "rental-arbitrage" && counter.route === "rental-arbitrage") {
    const deltas: CommercialDeltaItem[] = [];
    const rent = counter.proposedMonthlyRent.amount - current.proposedMonthlyRent.amount;
    if (rent) deltas.push({ label: "Monthly rent", delta: `${signedCurrency(rent)}/month` });
    const term = counter.leaseTermMonths - current.leaseTermMonths;
    if (term) deltas.push({ label: "Lease term", delta: `${term > 0 ? "+" : ""}${term} months` });
    const commencement = dayDelta(current.proposedCommencementDate, counter.proposedCommencementDate);
    if (commencement) deltas.push({ label: "Commencement", delta: signedDays(commencement) });
    if (current.operatingPermissionRequested !== counter.operatingPermissionRequested) deltas.push({ label: "Operating permission", delta: counter.operatingPermissionRequested ? "Now requested" : "No longer requested" });
    return deltas;
  }
  return [];
}

function comparisonRows(current: AcquisitionOfferHeadlineTerms, counter: AcquisitionOfferHeadlineTerms) {
  if (current.route !== counter.route) return [{ label: "Acquisition route", current: title(current.route), counter: title(counter.route), changed: true }];
  if (current.route === "purchase" && counter.route === "purchase") return [
    comparison("Offer price", money(current.offerPrice.amount), money(counter.offerPrice.amount)),
    comparison("Financing", title(current.financingType), title(counter.financingType)),
    comparison("Closing", current.proposedClosingDate ? formatDate(current.proposedClosingDate) : "Not set", counter.proposedClosingDate ? formatDate(counter.proposedClosingDate) : "Not set"),
  ];
  if (current.route === "rental-arbitrage" && counter.route === "rental-arbitrage") return [
    comparison("Monthly rent", money(current.proposedMonthlyRent.amount), money(counter.proposedMonthlyRent.amount)),
    comparison("Lease term", `${current.leaseTermMonths} months`, `${counter.leaseTermMonths} months`),
    comparison("Commencement", current.proposedCommencementDate ? formatDate(current.proposedCommencementDate) : "Not set", counter.proposedCommencementDate ? formatDate(counter.proposedCommencementDate) : "Not set"),
    comparison("Operating permission", current.operatingPermissionRequested ? "Requested" : "Not requested", counter.operatingPermissionRequested ? "Requested" : "Not requested"),
  ];
  return [];
}

function HeadlineTerms({ terms }: { terms: AcquisitionOfferHeadlineTerms }) {
  return terms.route === "purchase" ? <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3"><SmallFact term="Offer price" value={money(terms.offerPrice.amount)} /><SmallFact term="Financing" value={title(terms.financingType)} /><SmallFact term="Closing date" value={terms.proposedClosingDate ? formatDate(terms.proposedClosingDate) : "Not set"} /></dl>
    : <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4"><SmallFact term="Monthly rent" value={money(terms.proposedMonthlyRent.amount)} /><SmallFact term="Lease term" value={`${terms.leaseTermMonths} months`} /><SmallFact term="Commencement" value={terms.proposedCommencementDate ? formatDate(terms.proposedCommencementDate) : "Not set"} /><SmallFact term="Operating permission" value={terms.operatingPermissionRequested ? "Requested" : "Not requested"} /></dl>;
}

function resolveCommercialState(commercial: AcquisitionCommercialWorkspaceSummary): CommercialState {
  if (commercial.contract) return "contracted";
  if (commercial.acceptedAgreement) return "accepted";
  if (commercial.latestResponse?.type === "countered") return "countered";
  if (commercial.latestResponse?.type === "rejected") return "rejected";
  const status = commercial.currentOffer?.status;
  if (status === "expired") return "expired";
  if (status === "withdrawn") return "withdrawn";
  if (status === "draft") return "draft";
  if (status === "submitted") return "submitted";
  return commercial.currentOffer ? "submitted" : "empty";
}
function resolveCommercialHealth(commercial: AcquisitionCommercialWorkspaceSummary, analysis: InvestmentAnalysisWorkspaceSummary | null): CommercialHealth {
  if (commercial.currentOffer?.status === "expired") return "expired";
  if (commercial.analysisAlignment?.status === "changed") return "blocked";
  if (!commercial.analysisAlignment || commercial.analysisAlignment.status === "unavailable" || analysis?.stale) return "attention";
  return "healthy";
}
function commercialGuidance(state: CommercialState) {
  if (state === "draft") return { purpose: "Complete a commercially coherent offer.", watchFor: "Missing headline terms and analysis drift.", nextObjective: "Submit the current offer." };
  if (state === "submitted") return { purpose: "Preserve the submitted position while awaiting a response.", watchFor: "Offer expiration and changed market facts.", nextObjective: "Receive and record the counterparty response." };
  if (state === "countered") return { purpose: "Evaluate the counter against the current offer and analysis basis.", watchFor: "Changed economics and concession drift.", nextObjective: "Choose the projected negotiation action." };
  if (state === "accepted") return { purpose: "Preserve the accepted commercial basis.", watchFor: "Differences between accepted terms and the executed contract.", nextObjective: "Record contract execution." };
  if (state === "contracted") return { purpose: "Retain complete commercial lineage into the executed contract.", watchFor: "Contract-to-agreement alignment.", nextObjective: "Continue into acquisition requirements." };
  if (["rejected", "expired", "withdrawn"].includes(state)) return { purpose: "Preserve the terminal offer outcome.", watchFor: "Do not treat inactive terms as the current position.", nextObjective: "Follow the projected workspace action." };
  return { purpose: "Establish the first commercial position.", watchFor: "Use the approved analysis as the offer basis.", nextObjective: "Create the first offer." };
}

function CommercialPanel({ title: heading, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const id = `commercial-${heading.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return <section aria-labelledby={id}><Card className="h-full p-5 sm:p-6"><div className="mb-5"><h3 id={id} className="text-lg font-semibold text-stone-950">{heading}</h3><p className="mt-1 text-sm text-stone-500">{description}</p></div>{children}</Card></section>;
}
function EmptyCopy({ title: heading, body }: { title: string; body: string }) { return <div className="rounded-xl bg-stone-50 p-5"><p className="font-semibold text-stone-900">{heading}</p><p className="mt-1 text-sm leading-6 text-stone-600">{body}</p></div>; }
function PositionFact({ term, value }: { term: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{term}</dt><dd className="mt-1 text-sm font-semibold text-white">{value}</dd></div>; }
function SmallFact({ term, value }: { term: string; value: string }) { return <div><dt className="eyebrow">{term}</dt><dd className="mt-1.5 text-sm font-semibold text-stone-800">{value}</dd></div>; }
function GuidanceFact({ term, value }: { term: string; value: string }) { return <div><dt className="eyebrow">{term}</dt><dd className="mt-1.5 text-sm leading-6 text-stone-700">{value}</dd></div>; }
function comparison(label: string, current: string, counter: string) { return { label, current, counter, changed: current !== counter }; }
function commercialStateLabel(state: CommercialState) { return state === "empty" ? "No offer" : state === "countered" ? "Counter received" : title(state); }
function commercialHealthLabel(health: CommercialHealth) { return health === "attention" ? "Attention required" : title(health); }
function commercialHealthTone(health: CommercialHealth): "success" | "warning" | "danger" { return health === "healthy" ? "success" : health === "attention" ? "warning" : "danger"; }
function positionDescription(state: CommercialState) { return state === "submitted" ? "The counterparty is reviewing the active offer." : state === "countered" ? "A counteroffer requires evaluation against the current position." : state === "accepted" ? "Commercial terms are accepted but not yet an executed contract." : state === "contracted" ? "The accepted agreement has progressed to a recorded contract." : state === "draft" ? "The active offer remains editable and has not been submitted." : state === "empty" ? "No commercial position exists yet." : `The current commercial outcome is ${commercialStateLabel(state).toLowerCase()}.`; }
function headlineSummary(terms: AcquisitionOfferHeadlineTerms) { return terms.route === "purchase" ? `${money(terms.offerPrice.amount)} · ${title(terms.financingType)}` : `${money(terms.proposedMonthlyRent.amount)}/month · ${terms.leaseTermMonths} months`; }
function title(value: string) { return value.split(/[-_]/).map(part => part ? part[0]!.toUpperCase() + part.slice(1) : part).join(" "); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function signedCurrency(value: number) { return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`; }
function dayDelta(from?: Date, to?: Date) { return from && to ? Math.round((to.getTime() - from.getTime()) / 86_400_000) : 0; }
function signedDays(value: number) { return `${value > 0 ? "+" : ""}${value} day${Math.abs(value) === 1 ? "" : "s"}`; }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value); }
