import { Money } from "@/platform/kernel";
import type { FinancialConfidence, FinancialFreshness } from "../../domain";
import type {
  BuildCashFlowLiquidityInput, CashAccountBalance, CashAccountSummary, CashBurnRateSummary,
  CashFlowEvidenceSummary, CashFlowLine, CashFlowLiquidityView, CashFlowSection, CashFlowStatement,
  CashFlowTrend, CashMovement, CashMovementDriver, CashPositionSummary, CashReconciliationResult,
  FinancialObligationSummary, LiquidityAttentionItem, LiquidityCondition, LiquidityOutlook,
  PropertyCashContribution, ReserveCoverageItem, ReserveCoverageSummary, CashRunwaySummary,
} from "./contracts";
import {
  CASH_CLASSIFICATION_POLICY_VERSION, CASH_FLOW_POLICY, CASH_RECONCILIATION_POLICY_VERSION,
  INTERNAL_TRANSFER_POLICY_VERSION, LIQUIDITY_POLICY_VERSION,
} from "./policies";

const confidenceRank: Record<FinancialConfidence, number> = { high: 0, moderate: 1, low: 2, "insufficient-evidence": 3 };
const freshnessRank: Record<FinancialFreshness, number> = { current: 0, partial: 1, stale: 2, unknown: 3 };
function minimumConfidence(values: readonly FinancialConfidence[]) { return values.reduce((lowest, value) => confidenceRank[value] > confidenceRank[lowest] ? value : lowest, "high"); }
function worstFreshness(values: readonly FinancialFreshness[]) { return values.reduce((worst, value) => freshnessRank[value] > freshnessRank[worst] ? value : worst, "current"); }
function assertCurrencies(currency: string, values: readonly Money[]) { if (values.some(value => value.currency !== currency)) throw new Error("CASH_FLOW_CURRENCY_MISMATCH"); }
function moneyValues(accounts: readonly CashAccountBalance[], movements: readonly CashMovement[]) {
  return [...accounts.flatMap(account => [account.openingBalance, account.closingBalance, account.restrictedAmount, account.committedAmount].filter((value): value is Money => Boolean(value))), ...movements.map(item => item.amount)];
}

export function matchInternalTransfers(movements: readonly CashMovement[]) {
  const candidates = movements.filter(item => item.classification === "internal-transfer" && item.transferReference);
  const matched = new Set<string>();
  for (const movement of candidates) {
    if (matched.has(movement.id)) continue;
    const counterpart = candidates.find(item => item.id !== movement.id && !matched.has(item.id)
      && item.transferReference === movement.transferReference && item.direction !== movement.direction
      && item.accountId !== movement.accountId && item.amount.currency === movement.amount.currency
      && item.amount.minorUnits === movement.amount.minorUnits);
    if (counterpart) { matched.add(movement.id); matched.add(counterpart.id); }
  }
  const transferCandidates = movements.filter(item => item.classification === "internal-transfer");
  return Object.freeze({
    matchedIds: matched as ReadonlySet<string>,
    matchedPairs: matched.size / 2,
    unmatched: Object.freeze(transferCandidates.filter(item => !matched.has(item.id))),
    coverage: transferCandidates.length ? matched.size / transferCandidates.length : 1,
  });
}

export function buildCashPositionSummary(input: BuildCashFlowLiquidityInput): CashPositionSummary {
  const currency = input.financial.identity.reportingCurrency, accounts = input.accounts;
  assertCurrencies(currency, moneyValues(accounts, []));
  const allOpening = accounts.length > 0 && accounts.every(account => account.openingBalance);
  const allClosing = accounts.length > 0 && accounts.every(account => account.closingBalance);
  const openingCash = allOpening ? accounts.reduce((sum, account) => sum.add(account.openingBalance!), Money.zero(currency)) : null;
  const closingCash = allClosing ? accounts.reduce((sum, account) => sum.add(account.closingBalance!), Money.zero(currency)) : null;
  const restrictionsComplete = allClosing && accounts.every(account => account.restrictionsComplete);
  const restrictedCash = restrictionsComplete ? accounts.reduce((sum, account) => sum.add(account.restrictedAmount ?? (["legally-restricted","contractually-restricted","reserved"].includes(account.restriction) ? account.closingBalance! : Money.zero(currency))), Money.zero(currency)) : null;
  const committedCash = restrictionsComplete ? accounts.reduce((sum, account) => sum.add(account.committedAmount ?? Money.zero(currency)), Money.zero(currency)) : null;
  const availableCash = closingCash && restrictedCash && committedCash ? closingCash.subtract(restrictedCash).subtract(committedCash) : null;
  return Object.freeze({
    openingCash, closingCash, totalCash: closingCash, availableCash, restrictedCash, committedCash,
    netCashMovement: openingCash && closingCash ? closingCash.subtract(openingCash) : null,
    asOf: accounts.map(item => item.closingAsOf).filter((value): value is string => Boolean(value)).sort()[0],
    confidence: accounts.length ? minimumConfidence(accounts.map(item => item.confidence)) : "insufficient-evidence",
    freshness: accounts.length ? worstFreshness(accounts.map(item => item.freshness)) : "unknown",
    evidenceIds: Object.freeze(accounts.flatMap(item => item.evidenceIds)),
  });
}

function section(activity: CashFlowSection["activity"], movements: readonly CashMovement[], matched: ReadonlySet<string>, currency: string): CashFlowSection {
  const included = movements.filter(item => item.activity === activity && !matched.has(item.id));
  const grouped = new Map<string, CashMovement[]>();
  for (const item of included) grouped.set(`${item.category}:${item.direction}`, [...(grouped.get(`${item.category}:${item.direction}`) ?? []), item]);
  const lines: CashFlowLine[] = [...grouped.entries()].map(([key, items]) => {
    const [category, direction] = key.split(":") as [string, "inflow" | "outflow"];
    const amount = items.reduce((sum, item) => sum.add(item.amount), Money.zero(currency));
    const unmatchedTransfer = items.some(item => item.classification === "internal-transfer");
    return {
      id: `${activity}:${key}`, category, label: category, amount, direction,
      classification: unmatchedTransfer ? "unknown" : items[0]!.classification,
      qualification: items.some(item => item.qualification !== "measured") ? "estimated" : "measured",
      confidence: minimumConfidence(items.map(item => item.confidence)), freshness: worstFreshness(items.map(item => item.freshness)),
      evidenceIds: Object.freeze(items.flatMap(item => item.evidenceIds)),
    };
  });
  const inflows = included.filter(item => item.direction === "inflow").reduce((sum, item) => sum.add(item.amount), Money.zero(currency));
  const outflows = included.filter(item => item.direction === "outflow").reduce((sum, item) => sum.add(item.amount), Money.zero(currency));
  return Object.freeze({ activity, inflows, outflows, net: inflows.subtract(outflows), lines: Object.freeze(lines.sort((a,b)=>b.amount.amount-a.amount.amount)) });
}

export function reconcileCashFlowStatement(openingCash: Money | null, closingCash: Money | null, classifiedMovement: Money): CashReconciliationResult {
  if (!openingCash || !closingCash) return { status: "unknown", openingCash, classifiedMovement, closingCash, unmatchedAmount: null, toleranceMinorUnits: CASH_FLOW_POLICY.reconciliationToleranceMinorUnits, explanation: "Opening and closing balances are required to reconcile the statement." };
  const expected = openingCash.add(classifiedMovement), gap = closingCash.subtract(expected);
  const reconciled = Math.abs(gap.minorUnits) <= CASH_FLOW_POLICY.reconciliationToleranceMinorUnits;
  return {
    status: reconciled ? "reconciled" : "unreconciled", openingCash, classifiedMovement, closingCash,
    unmatchedAmount: reconciled ? Money.zero(openingCash.currency) : gap,
    toleranceMinorUnits: CASH_FLOW_POLICY.reconciliationToleranceMinorUnits,
    explanation: reconciled ? "Opening cash plus classified net movement reconciles to closing cash." : `Cash flow does not fully reconcile; ${gap.format()} remains unmatched.`,
  };
}

export function buildCashFlowStatement(input: BuildCashFlowLiquidityInput, position = buildCashPositionSummary(input)): CashFlowStatement {
  const currency = input.financial.identity.reportingCurrency;
  assertCurrencies(currency, moneyValues([], input.movements));
  const transfers = matchInternalTransfers(input.movements);
  const operating = section("operating", input.movements, transfers.matchedIds, currency);
  const investing = section("investing", input.movements, transfers.matchedIds, currency);
  const financing = section("financing", input.movements, transfers.matchedIds, currency);
  const other = section("other", input.movements, transfers.matchedIds, currency);
  const net = operating.net.add(investing.net).add(financing.net).add(other.net);
  const reconciliation = reconcileCashFlowStatement(position.openingCash, position.closingCash, net);
  const evidenceIds = input.movements.flatMap(item => item.evidenceIds);
  return Object.freeze({
    operatingActivities: operating, investingActivities: investing, financingActivities: financing, otherAdjustments: other,
    netCashMovement: net, openingCash: position.openingCash, closingCash: position.closingCash,
    internalTransfersEliminated: transfers.matchedPairs, unmatchedTransfers: transfers.unmatched,
    reconciliation, confidence: input.movements.length ? minimumConfidence(input.movements.map(item => item.confidence).concat(transfers.coverage < CASH_FLOW_POLICY.minimumTransferMatchCoverage ? ["low"] : [])) : "insufficient-evidence",
    evidenceIds: Object.freeze(evidenceIds),
  });
}

export function buildCashAccountSummaries(input: BuildCashFlowLiquidityInput): readonly CashAccountSummary[] {
  if (!input.canViewAccounts) return Object.freeze([]);
  return Object.freeze(input.accounts.map(account => {
    const restricted = account.restrictedAmount ?? (account.restriction === "available" ? Money.zero(account.currency) : account.restrictionsComplete ? account.closingBalance : undefined);
    const available = account.closingBalance && account.restrictionsComplete && restricted ? account.closingBalance.subtract(restricted).subtract(account.committedAmount ?? Money.zero(account.currency)) : null;
    return { id: account.id, label: account.label, type: account.type, balance: account.closingBalance ?? null, availableBalance: available, restriction: account.restriction, status: account.status, reconciliation: account.reconciliation, currency: account.currency, ...(account.propertyId ? { propertyId: account.propertyId } : {}), asOf: account.closingAsOf, confidence: account.confidence, freshness: account.freshness };
  }));
}

export function buildPropertyCashContribution(input: BuildCashFlowLiquidityInput, matched: ReadonlySet<string>): Readonly<{ properties: readonly PropertyCashContribution[]; unallocated: Money }> {
  const currency = input.financial.identity.reportingCurrency, economic = input.movements.filter(item => !matched.has(item.id) && item.classification !== "reclassification");
  const properties = Object.entries(input.propertyLabels).map(([propertyId, label]) => {
    const items = economic.filter(item => item.propertyId === propertyId && item.allocated);
    const net = (activity: CashFlowSection["activity"]) => {
      const values = items.filter(item => item.activity === activity);
      return values.reduce((sum, item) => item.direction === "inflow" ? sum.add(item.amount) : sum.subtract(item.amount), Money.zero(currency));
    };
    const operatingInflows = items.filter(item => item.activity === "operating" && item.direction === "inflow").reduce((sum,item)=>sum.add(item.amount),Money.zero(currency));
    const operatingOutflows = items.filter(item => item.activity === "operating" && item.direction === "outflow").reduce((sum,item)=>sum.add(item.amount),Money.zero(currency));
    const operatingCashFlow = operatingInflows.subtract(operatingOutflows), investingCashFlow = net("investing"), financingCashFlow = net("financing");
    return { propertyId, label, operatingInflows, operatingOutflows, operatingCashFlow, investingCashFlow, financingCashFlow, netCashContribution: operatingCashFlow.add(investingCashFlow).add(financingCashFlow).add(net("other")), confidence: items.length ? minimumConfidence(items.map(item=>item.confidence)) : "insufficient-evidence", freshness: items.length ? worstFreshness(items.map(item=>item.freshness)) : "unknown", evidenceIds: items.flatMap(item=>item.evidenceIds) };
  });
  const unallocatedItems = economic.filter(item => !item.propertyId || !item.allocated);
  const unallocated = unallocatedItems.reduce((sum,item)=>item.direction==="inflow"?sum.add(item.amount):sum.subtract(item.amount),Money.zero(currency));
  return { properties: Object.freeze(properties), unallocated };
}

export function buildUpcomingObligations(input: BuildCashFlowLiquidityInput, availableCash: Money | null): FinancialObligationSummary {
  const horizonDays = input.obligationHorizonDays ?? 30, evaluatedAt = Date.parse(input.evaluatedAt ?? input.financial.evaluatedAt);
  if (!input.canViewObligations) return { sourceAvailable: false, coverage: 0, horizonDays, items: [], totalKnown: null, availableCashCoverage: null, fundingGap: null, confidence: "insufficient-evidence" };
  const items = input.obligations.items.filter(item => {
    const days = (Date.parse(`${item.dueDate}T00:00:00Z`) - evaluatedAt) / 86_400_000;
    return days <= horizonDays && !["paid","cancelled"].includes(item.status);
  }).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const sufficient = input.obligations.sourceAvailable && input.obligations.coverage >= CASH_FLOW_POLICY.minimumObligationCoverage;
  const totalKnown = sufficient ? items.reduce((sum,item)=>sum.add(item.amount),Money.zero(input.financial.identity.reportingCurrency)) : null;
  const ratio = totalKnown && totalKnown.amount > 0 && availableCash ? availableCash.amount / totalKnown.amount : null;
  const gap = totalKnown && availableCash && totalKnown.amount > availableCash.amount ? totalKnown.subtract(availableCash) : totalKnown && availableCash ? Money.zero(totalKnown.currency) : null;
  return { sourceAvailable: input.obligations.sourceAvailable, coverage: input.obligations.coverage, horizonDays, items: Object.freeze(items), totalKnown, availableCashCoverage: ratio, fundingGap: gap, confidence: sufficient ? minimumConfidence(items.map(item=>item.confidence)) : "insufficient-evidence" };
}

export function evaluateReserveCoverage(input: BuildCashFlowLiquidityInput, statement: CashFlowStatement): ReserveCoverageSummary {
  if (!input.canViewReserves || !input.reservePolicies.length) return { configured: false, items: [], overallStatus: "not-configured" };
  const currency = input.financial.identity.reportingCurrency;
  const items: ReserveCoverageItem[] = input.reservePolicies.map(policy => {
    const relevant = input.accounts.filter(account => account.type === "reserve" && (!policy.propertyId || account.propertyId === policy.propertyId));
    const complete = relevant.length > 0 && relevant.every(account => account.closingBalance);
    const balance = complete ? relevant.reduce((sum,account)=>sum.add(account.closingBalance!),Money.zero(currency)) : null;
    const gap = balance ? balance.subtract(policy.target) : null, coverage = balance && policy.target.amount > 0 ? balance.amount / policy.target.amount : null;
    const monthlyOutflow = statement.operatingActivities.outflows.amount / Math.max(1,input.historyMonths);
    const months = balance && input.historyMonths >= policy.lookbackMonths && monthlyOutflow > 0 ? balance.amount / monthlyOutflow : null;
    const status = !balance ? "insufficient-evidence" : coverage === null ? "insufficient-evidence" : coverage >= 1 ? coverage >= CASH_FLOW_POLICY.strongReserveCoverage ? "above-target" : "at-target" : coverage <= .25 ? "critical" : "below-target";
    return { policyId: policy.id, type: policy.type, currentBalance: balance, target: policy.target, gap, coveragePercentage: coverage, monthsOfCoverage: months, status, lookbackMonths: policy.lookbackMonths, confidence: balance ? minimumConfidence(relevant.map(item=>item.confidence)) : "insufficient-evidence", evidenceIds: [...policy.evidenceIds,...relevant.flatMap(item=>item.evidenceIds)] };
  });
  const order: Record<ReserveCoverageItem["status"],number> = {"above-target":0,"at-target":1,"not-configured":2,"below-target":3,"insufficient-evidence":4,critical:5};
  return { configured: true, items: Object.freeze(items), overallStatus: items.reduce<ReserveCoverageItem["status"]>((worst,item)=>order[item.status]>order[worst]?item.status:worst,"above-target") };
}

export function calculateCashBurnRate(input: BuildCashFlowLiquidityInput, statement: CashFlowStatement): CashBurnRateSummary {
  if (!input.movements.length || input.historyMonths <= 0) return { grossCashBurn:null,netCashBurn:null,operatingCashBurn:null,basis:"average-qualifying-outflows",lookbackMonths:input.historyMonths,exclusions:["Internal transfers"],applicable:false,explanation:"Transaction history is insufficient to calculate burn rate.",confidence:"insufficient-evidence" };
  const currency=input.financial.identity.reportingCurrency, months=Math.max(1,input.historyMonths);
  const gross=Money.of(statement.operatingActivities.outflows.amount/months,currency);
  const net=statement.netCashMovement.amount<0?Money.of(-statement.netCashMovement.amount/months,currency):Money.zero(currency);
  const operating=statement.operatingActivities.net.amount<0?Money.of(-statement.operatingActivities.net.amount/months,currency):Money.zero(currency);
  const applicable=operating.amount>0||net.amount>0;
  return {grossCashBurn:gross,netCashBurn:net,operatingCashBurn:operating,basis:"average-qualifying-outflows",lookbackMonths:input.historyMonths,exclusions:["Matched internal transfers","Nonrecurring capital outflows from operating burn"],applicable,explanation:applicable?"Burn reflects average qualifying cash movement over the disclosed lookback.":"No operating cash burn during this period.",confidence:statement.confidence};
}

export function calculateCashRunway(position: CashPositionSummary, burn: CashBurnRateSummary, obligationCoverage: number, historyMonths: number): CashRunwaySummary {
  const assumptions=["Current available cash remains available.","Observed net burn continues at the measured average."],exclusions=["Unscheduled capital projects","Unconfigured obligations"];
  if (!burn.applicable || !burn.netCashBurn || burn.netCashBurn.amount<=0) return {months:null,status:"not-applicable",basis:`Trailing ${historyMonths}-month net cash movement`,assumptions,exclusions,confidence:burn.confidence};
  if (!position.availableCash || historyMonths<CASH_FLOW_POLICY.minimumRunwayHistoryMonths || obligationCoverage<CASH_FLOW_POLICY.minimumObligationCoverage) return {months:null,status:"insufficient-evidence",basis:`Trailing ${historyMonths}-month net cash burn`,assumptions,exclusions,confidence:"insufficient-evidence"};
  return {months:position.availableCash.amount/burn.netCashBurn.amount,status:"available",basis:`Trailing ${historyMonths}-month net cash burn`,assumptions,exclusions,confidence:minimumConfidence([position.confidence,burn.confidence])};
}

export function buildLiquidityOutlook(input: BuildCashFlowLiquidityInput, position: CashPositionSummary, obligations: FinancialObligationSummary): LiquidityOutlook {
  const horizon=input.scheduledCash?.horizonDays??obligations.horizonDays, scheduledInflows=input.scheduledCash?.inflows??null, scheduledOutflows=input.scheduledCash?.outflows??obligations.totalKnown;
  const sufficient=Boolean(position.availableCash&&scheduledOutflows&&obligations.coverage>=CASH_FLOW_POLICY.minimumObligationCoverage);
  if(!sufficient)return{horizonDays:horizon,openingAvailableCash:position.availableCash,scheduledInflows,scheduledOutflows,projectedClosingAvailableCash:null,fundingGap:null,status:"insufficient-evidence",qualification:"unavailable",assumptions:input.scheduledCash?.assumptions??["Only known obligations are included."],confidence:"insufficient-evidence",evidenceIds:input.scheduledCash?.evidenceIds??[]};
  const closing=position.availableCash!.add(scheduledInflows??Money.zero(position.availableCash!.currency)).subtract(scheduledOutflows!);
  const gap=closing.amount<0?Money.of(-closing.amount,closing.currency):Money.zero(closing.currency);
  const status=closing.amount<0?"funding-gap-expected":closing.amount===0?"balanced":scheduledOutflows!.amount>position.availableCash!.amount?"pressure-expected":"surplus-expected";
  return{horizonDays:horizon,openingAvailableCash:position.availableCash,scheduledInflows,scheduledOutflows,projectedClosingAvailableCash:closing,fundingGap:gap,status,qualification:input.scheduledCash?.qualification??"measured",assumptions:input.scheduledCash?.assumptions??["Only known obligations are included."],confidence:minimumConfidence([position.confidence,obligations.confidence]),evidenceIds:input.scheduledCash?.evidenceIds??[]};
}

export function evaluateLiquidityCondition(input: Readonly<{position:CashPositionSummary;statement:CashFlowStatement;obligations:FinancialObligationSummary;reserves:ReserveCoverageSummary;runway:CashRunwaySummary;evidence:CashFlowEvidenceSummary}>):LiquidityCondition{
  const insufficient=!input.position.availableCash||input.evidence.accountCoverage<CASH_FLOW_POLICY.minimumAccountCoverage||input.obligations.coverage<CASH_FLOW_POLICY.minimumObligationCoverage;
  const critical=!insufficient&&((input.obligations.fundingGap?.amount??0)>0||input.reserves.overallStatus==="critical"||(input.runway.status==="available"&&(input.runway.months??Infinity)<CASH_FLOW_POLICY.criticalRunwayMonths));
  const tight=!insufficient&&!critical&&(input.reserves.overallStatus==="below-target"||(input.runway.status==="available"&&(input.runway.months??Infinity)<CASH_FLOW_POLICY.tightRunwayMonths)||input.statement.operatingActivities.net.amount<0);
  const strong=!insufficient&&!critical&&!tight&&input.statement.operatingActivities.net.amount>0&&["above-target","at-target","not-configured"].includes(input.reserves.overallStatus);
  const status=insufficient?"insufficient-evidence":critical?"critical":tight?"tight":strong?"strong":"adequate";
  const summary=status==="insufficient-evidence"?"Liquidity cannot be established until cash-account and obligation coverage meet policy.":status==="critical"?"Available cash does not cover a defined near-term liquidity requirement.":status==="tight"?"Liquidity remains positive but reserve, runway, or operating-cash pressure requires inspection.":status==="strong"?"Available cash and operating cash generation are materially favorable under current evidence.":"No material positive or negative liquidity condition dominates.";
  return{status,summary,positiveDrivers:[...(input.statement.operatingActivities.net.amount>0?["Operations generated cash."]:[]),...(input.obligations.fundingGap?.amount===0?["Available cash covers known near-term obligations."]:[])],limitingConditions:[...(input.obligations.coverage<CASH_FLOW_POLICY.minimumObligationCoverage?["Obligation coverage is incomplete."]:[]),...(input.statement.reconciliation.status!=="reconciled"?["Cash flow is not fully reconciled."]:[]),...(input.reserves.overallStatus==="below-target"||input.reserves.overallStatus==="critical"?["A configured reserve is below target."]:[])],confidence:input.evidence.confidence,evidenceIds:[...input.position.evidenceIds,...input.statement.evidenceIds],policyVersion:LIQUIDITY_POLICY_VERSION};
}

function drivers(input:BuildCashFlowLiquidityInput,matched:ReadonlySet<string>){
  const economic=input.movements.filter(item=>!matched.has(item.id)),grouped=new Map<string,CashMovement[]>();
  for(const item of economic)grouped.set(`${item.category}:${item.direction}`,[...(grouped.get(`${item.category}:${item.direction}`)??[]),item]);
  const values=[...grouped.entries()].map(([key,items])=>{const [label,direction]=key.split(":")as[string,"inflow"|"outflow"];return{id:key,label,amount:items.reduce((sum,item)=>sum.add(item.amount),Money.zero(input.financial.identity.reportingCurrency)),direction,activity:items[0]!.activity,classification:items.some(item=>item.classification==="internal-transfer")?"unknown"as const:items[0]!.classification,recurring:items.some(item=>item.recurring==="nonrecurring")?"nonrecurring"as const:items.every(item=>item.recurring==="recurring")?"recurring"as const:"unknown"as const,propertyIds:[...new Set(items.flatMap(item=>item.propertyId?[item.propertyId]:[]))],confidence:minimumConfidence(items.map(item=>item.confidence)),evidenceIds:items.flatMap(item=>item.evidenceIds)}}).sort((a,b)=>b.amount.amount-a.amount.amount);
  const map=(items:typeof values):readonly CashMovementDriver[]=>Object.freeze(items.slice(0,5));
  return{inflows:map(values.filter(item=>item.direction==="inflow")),outflows:map(values.filter(item=>item.direction==="outflow")),nonrecurring:map(values.filter(item=>item.recurring==="nonrecurring")),unmatched:map(values.filter(item=>item.classification==="unknown"))};
}

function evidence(input:BuildCashFlowLiquidityInput,position:CashPositionSummary,statement:CashFlowStatement,obligations:FinancialObligationSummary,reserves:ReserveCoverageSummary,transferCoverage:number):CashFlowEvidenceSummary{
  const accounts=input.accounts.length,balances=input.accounts.filter(item=>item.closingBalance).length,movements=input.movements.length,transactions=input.movements.filter(item=>item.evidenceIds.length).length,attributed=input.movements.filter(item=>item.propertyId&&item.allocated).length;
  const gaps=[...(accounts?[]:["Cash accounts unavailable."]),...(balances<accounts?["One or more cash balances are unavailable."]:[]),...(movements?[]:["Cash transaction history unavailable."]),...(obligations.coverage<CASH_FLOW_POLICY.minimumObligationCoverage?["Obligation coverage incomplete."]:[]),...(transferCoverage<CASH_FLOW_POLICY.minimumTransferMatchCoverage?["Internal transfer matching incomplete."]:[]),...(statement.reconciliation.status!=="reconciled"?["Cash statement is not fully reconciled."]:[])];
  const confidence:FinancialConfidence=!accounts||!balances?"insufficient-evidence":gaps.length>=3?"low":gaps.length?"moderate":"high";
  return{accountCoverage:accounts?balances/accounts:0,balanceCoverage:accounts?balances/accounts:0,transactionCoverage:movements?transactions/movements:0,transferMatchCoverage:transferCoverage,obligationCoverage:obligations.coverage,reserveClassificationCoverage:reserves.configured?reserves.items.filter(item=>item.currentBalance).length/Math.max(1,reserves.items.length):0,propertyAttribution:movements?attributed/movements:0,reconciliation:statement.reconciliation.status,historyMonths:input.historyMonths,currencyCompatible:true,limitingSource:gaps[0],gaps:Object.freeze(gaps),confidence,freshness:position.freshness};
}

function trends(current:BuildCashFlowLiquidityInput,position:CashPositionSummary,statement:CashFlowStatement):readonly CashFlowTrend[]{
  if(!current.comparisonAccounts&&!current.comparisonMovements)return Object.freeze((["opening-cash","closing-cash","operating-cash-flow","investing-cash-flow","financing-cash-flow","net-cash-movement","available-cash"]as const).map(metric=>({metric,current:metricValue(metric,position,statement),comparison:null,variance:null,classification:"insufficient-evidence"as const,confidence:"insufficient-evidence"as const})));
  const comparisonInput={...current,accounts:current.comparisonAccounts??[],movements:current.comparisonMovements??[],comparisonAccounts:undefined,comparisonMovements:undefined};
  const cp=buildCashPositionSummary(comparisonInput),cs=buildCashFlowStatement(comparisonInput,cp);
  return Object.freeze((["opening-cash","closing-cash","operating-cash-flow","investing-cash-flow","financing-cash-flow","net-cash-movement","available-cash"]as const).map((metric):CashFlowTrend=>{const value=metricValue(metric,position,statement),prior=metricValue(metric,cp,cs),variance=value&&prior?value.subtract(prior):null;return{metric,current:value,comparison:prior,variance,classification:!value||!prior?"insufficient-evidence":!variance||Math.abs(variance.amount)/Math.max(Math.abs(prior.amount),1)<.02?"stable":variance.amount>0?"improving":"declining",confidence:value&&prior?minimumConfidence([position.confidence,cp.confidence]):"insufficient-evidence"}}));
}
function metricValue(metric:CashFlowTrend["metric"],position:CashPositionSummary,statement:CashFlowStatement){return metric==="opening-cash"?position.openingCash:metric==="closing-cash"?position.closingCash:metric==="operating-cash-flow"?statement.operatingActivities.net:metric==="investing-cash-flow"?statement.investingActivities.net:metric==="financing-cash-flow"?statement.financingActivities.net:metric==="net-cash-movement"?statement.netCashMovement:position.availableCash;}

function attention(input:BuildCashFlowLiquidityInput,position:CashPositionSummary,statement:CashFlowStatement,obligations:FinancialObligationSummary,reserves:ReserveCoverageSummary,evidenceSummary:CashFlowEvidenceSummary):readonly LiquidityAttentionItem[]{
  const items:LiquidityAttentionItem[]=[];
  if(position.availableCash?.amount!==undefined&&position.availableCash.amount<=0)items.push({id:"low-cash",type:"low-available-cash",subject:"Available Cash",condition:"Available cash is zero or negative.",whyItMatters:"Near-term activity may require another verified source of liquidity.",amount:position.availableCash,confidence:position.confidence,evidenceIds:position.evidenceIds,destination:"#cash-position"});
  if(statement.operatingActivities.net.amount<0)items.push({id:"negative-operations",type:"negative-operating-cash-flow",subject:"Operating Cash Flow",condition:`Operations used ${Money.of(-statement.operatingActivities.net.amount,statement.netCashMovement.currency).format()}.`,whyItMatters:"Recurring operations consumed cash during the selected period.",amount:statement.operatingActivities.net,confidence:statement.confidence,evidenceIds:statement.evidenceIds,destination:"#cash-statement"});
  if(obligations.fundingGap?.amount)items.push({id:"funding-gap",type:"upcoming-funding-gap",subject:`${obligations.horizonDays}-Day Obligations`,condition:`Known obligations exceed available cash by ${obligations.fundingGap.format()}.`,whyItMatters:"The selected scope has a measured near-term funding gap.",amount:obligations.fundingGap,horizonDays:obligations.horizonDays,confidence:obligations.confidence,evidenceIds:obligations.items.flatMap(item=>item.evidenceIds),destination:"#cash-obligations"});
  if(reserves.overallStatus==="below-target"||reserves.overallStatus==="critical"){const item=reserves.items.find(value=>value.status===reserves.overallStatus);items.push({id:"reserve-gap",type:"reserve-gap",subject:"Configured Reserve",condition:`Reserve coverage is ${reserves.overallStatus.replace("-"," ")}.`,whyItMatters:"Available designated reserves are below configured policy.",amount:item?.gap??undefined,confidence:item?.confidence??"insufficient-evidence",evidenceIds:item?.evidenceIds??[],destination:"#cash-reserves"});}
  if(statement.reconciliation.status==="unreconciled")items.push({id:"reconciliation",type:"unreconciled-cash",subject:"Cash Reconciliation",condition:statement.reconciliation.explanation,whyItMatters:"Classified cash activity does not explain the balance movement.",amount:statement.reconciliation.unmatchedAmount??undefined,confidence:statement.confidence,evidenceIds:statement.evidenceIds,destination:"#cash-evidence"});
  if(statement.unmatchedTransfers.length)items.push({id:"unmatched-transfer",type:"unmatched-transfer",subject:"Internal Transfers",condition:`${statement.unmatchedTransfers.length} transfer movements remain unmatched.`,whyItMatters:"Unmatched transfers can distort economic cash-flow interpretation.",confidence:"low",evidenceIds:statement.unmatchedTransfers.flatMap(item=>item.evidenceIds),destination:"#cash-evidence"});
  if(evidenceSummary.obligationCoverage<CASH_FLOW_POLICY.minimumObligationCoverage)items.push({id:"obligation-coverage",type:"missing-obligation-coverage",subject:"Obligation Coverage",condition:"Upcoming obligations are partially available.",whyItMatters:"Missing obligations prevent reliable coverage and runway conclusions.",confidence:"insufficient-evidence",evidenceIds:[],destination:"#cash-obligations"});
  for(const account of input.accounts.filter(item=>item.freshness==="stale").slice(0,1))items.push({id:`stale:${account.id}`,type:"stale-account",subject:account.label,condition:"The cash account balance is stale.",whyItMatters:"Recent cash activity may not be reflected.",accountId:account.id,confidence:account.confidence,evidenceIds:account.evidenceIds,destination:"#cash-accounts"});
  return Object.freeze(items.slice(0,5));
}

export function buildCashFlowLiquidityView(input:BuildCashFlowLiquidityInput):CashFlowLiquidityView{
  const currency=input.financial.identity.reportingCurrency;assertCurrencies(currency,moneyValues(input.accounts,input.movements));
  const privatePosition=buildCashPositionSummary(input),privateStatement=buildCashFlowStatement(input,privatePosition),transfers=matchInternalTransfers(input.movements);
  const position=input.canViewAccounts?privatePosition:Object.freeze({...privatePosition,openingCash:null,closingCash:null,totalCash:null,availableCash:null,restrictedCash:null,committedCash:null,netCashMovement:null,evidenceIds:Object.freeze([])});
  const redactSection=(value:CashFlowSection):CashFlowSection=>input.canViewTransactions?value:Object.freeze({...value,lines:Object.freeze([])});
  const statement=input.canViewTransactions?privateStatement:Object.freeze({...privateStatement,operatingActivities:redactSection(privateStatement.operatingActivities),investingActivities:redactSection(privateStatement.investingActivities),financingActivities:redactSection(privateStatement.financingActivities),otherAdjustments:redactSection(privateStatement.otherAdjustments),openingCash:position.openingCash,closingCash:position.closingCash,internalTransfersEliminated:0,unmatchedTransfers:Object.freeze([]),evidenceIds:Object.freeze([])});
  const property=buildPropertyCashContribution(input,transfers.matchedIds),obligations=buildUpcomingObligations(input,position.availableCash),reserves=evaluateReserveCoverage(input,statement),burnRate=calculateCashBurnRate(input,statement),runway=calculateCashRunway(position,burnRate,obligations.coverage,input.historyMonths),outlook=buildLiquidityOutlook(input,position,obligations),evidenceSummary=evidence(input,position,statement,obligations,reserves,transfers.coverage),condition=evaluateLiquidityCondition({position,statement,obligations,reserves,runway,evidence:evidenceSummary});
  const empty=!input.accounts.length&&!input.movements.length,state=empty?"empty":input.permissionLimited?"permission-limited":!input.accounts.length?"transactions-only":!input.movements.length?"balances-only":statement.reconciliation.status==="unreconciled"?"unreconciled":position.freshness==="stale"?"degraded":evidenceSummary.gaps.length?"partial":"ready";
  return Object.freeze({identity:input.financial.identity,scope:input.scope,period:input.financial.period,...(input.comparisonType?{comparison:{type:input.comparisonType,available:Boolean(input.comparisonAccounts||input.comparisonMovements),...(!input.comparisonAccounts&&!input.comparisonMovements?{limitation:"Compatible cash comparison evidence is unavailable."}:{})}}:{}),reportingCurrency:currency,condition,position,statement,drivers:input.canViewTransactions?drivers(input,transfers.matchedIds):{inflows:[],outflows:[],nonrecurring:[],unmatched:[]},accounts:buildCashAccountSummaries(input),propertyContribution:property.properties,unallocatedCashActivity:property.unallocated,obligations,reserves,burnRate,runway,outlook,trends:trends(input,position,statement),attention:attention({...input,accounts:input.canViewAccounts?input.accounts:[]},position,statement,obligations,reserves,evidenceSummary),evidence:evidenceSummary,confidence:evidenceSummary.confidence,freshness:evidenceSummary.freshness,evaluatedAt:input.evaluatedAt??input.financial.evaluatedAt,projectionVersion:input.projectionVersion??`${CASH_CLASSIFICATION_POLICY_VERSION}:${INTERNAL_TRANSFER_POLICY_VERSION}:${CASH_RECONCILIATION_POLICY_VERSION}:${LIQUIDITY_POLICY_VERSION}`,state,permissionLimited:Boolean(input.permissionLimited)});
}
