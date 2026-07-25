import { ConfidenceLevel } from "@/platform/scoring";
import { aggregatePortfolioFreshness, type PortfolioProjection, type PortfolioPropertyProjection } from "@/features/portfolio";
import { COMPOSITION_CONCENTRATION_POLICY } from "./policies";
import type {
  BuildPortfolioCompositionQuery, CompositionDimension,
  CompositionDimensionType, CompositionEntry, ConcentrationBasis, ConcentrationStatus,
  DiversificationSummary, PortfolioComposition, PortfolioCompositionInput, PortfolioConcentration,
  PortfolioDistribution, PortfolioSeasonality,
} from "./contracts";

type ValueSelector = (property: PortfolioPropertyProjection, input: PortfolioCompositionInput) => string | null;
const selectors: Readonly<Record<Exclude<CompositionDimensionType, "booking-source" | "season">, ValueSelector>> = {
  market: (property) => property.market,
  geography: (property, input) => input.properties[property.propertyId]?.state ?? input.properties[property.propertyId]?.country ?? null,
  "property-type": (property, input) => input.properties[property.propertyId]?.propertyType ?? null,
  bedrooms: (property, input) => bedroomLabel(input.properties[property.propertyId]?.bedrooms),
  "operating-model": (property) => property.operatingModel,
  "acquisition-strategy": (property, input) => input.properties[property.propertyId]?.acquisitionStrategy ?? null,
};

export function buildCompositionDimension(type: Exclude<CompositionDimensionType, "booking-source" | "season">, projection: PortfolioProjection, input: PortfolioCompositionInput): CompositionDimension {
  const selector = selectors[type];
  const known = projection.properties.flatMap((property) => {
    const value = selector(property, input);
    return value ? [{ property, value }] : [];
  });
  const entries = [...new Set(known.map(({ value }) => value))].map((value) => entry(
    value, known.filter((item) => item.value === value).map(({ property }) => property),
    projection.performance.grossRevenue, projection.performance.bookingCount, projection.properties.length,
  )).sort((left, right) => (right.revenueShare ?? right.propertyShare) - (left.revenueShare ?? left.propertyShare));
  const coverage = projection.properties.length ? known.length / projection.properties.length : 0;
  return Object.freeze({
    type, label: dimensionLabel(type), entries, coverage,
    freshness: aggregatePortfolioFreshness(known.map(({ property }) => property.freshness)),
    confidence: coverage >= 1 ? projection.confidence : coverage >= 0.6 ? ConfidenceLevel.MODERATE : ConfidenceLevel.LOW,
    ...(coverage === 0 ? { unavailableReason: `${dimensionLabel(type)} metadata is unavailable for the current scope.` } : {}),
  });
}

function buildBookingSourceDimension(projection: PortfolioProjection, input: PortfolioCompositionInput): CompositionDimension {
  const totalRevenue = input.bookingSources.reduce((sum, item) => sum + item.revenue, 0);
  const totalBookings = input.bookingSources.reduce((sum, item) => sum + item.bookings, 0);
  const grouped = [...new Set(input.bookingSources.map(({ source }) => source))].map((source) => {
    const items = input.bookingSources.filter((item) => item.source === source);
    const revenue = items.reduce((sum, item) => sum + item.revenue, 0);
    const bookings = items.reduce((sum, item) => sum + item.bookings, 0);
    const propertyIds = [...new Set(items.map(({ propertyId }) => propertyId))];
    return { key: source.toLowerCase(), label: source, propertyIds, propertyCount: propertyIds.length, propertyShare: projection.properties.length ? propertyIds.length / projection.properties.length : 0, revenue, revenueShare: totalRevenue ? revenue / totalRevenue : null, bookings, bookingShare: totalBookings ? bookings / totalBookings : null };
  }).sort((left, right) => (right.revenueShare ?? 0) - (left.revenueShare ?? 0));
  const covered = new Set(input.bookingSources.map(({ propertyId }) => propertyId)).size;
  const coverage = projection.properties.length ? covered / projection.properties.length : 0;
  return { type: "booking-source", label: "Booking sources", entries: grouped, coverage, freshness: projection.freshness, confidence: coverage >= 1 ? projection.confidence : ConfidenceLevel.LOW, ...(coverage === 0 ? { unavailableReason: "Provider booking-source attribution is unavailable." } : {}) };
}

export function evaluateConcentration(dimension: CompositionDimension, basis: ConcentrationBasis, projection: PortfolioProjection, policy = COMPOSITION_CONCENTRATION_POLICY): PortfolioConcentration {
  const shares = dimension.entries.map((item) => basis === "revenue" ? item.revenueShare : basis === "bookings" ? item.bookingShare : item.propertyShare).filter((value): value is number => value !== null).sort((left, right) => right - left);
  const top = shares[0] ?? null; const topTwo = shares.length ? shares.slice(0,2).reduce((sum,value)=>sum+value,0) : null; const topThree = shares.length ? shares.slice(0,3).reduce((sum,value)=>sum+value,0) : null;
  const status = concentrationStatus(top, dimension.coverage, policy);
  const threshold = status === "critical-dependency" ? policy.criticalThreshold : status === "highly-concentrated" ? policy.highThreshold : status === "moderately-concentrated" ? policy.moderateThreshold : status === "diversified" ? policy.moderateThreshold : null;
  const measured = dimension.entries[0]?.label ?? null;
  return Object.freeze({
    id: `concentration:${dimension.type}:${basis}`, dimension: dimension.type, label: `${dimension.label} concentration`, basis,
    status, topShare: top, topTwoShare: topTwo, topThreeShare: topThree, measuredItem: measured, threshold,
    statement: top === null ? `${dimension.label} concentration is unavailable.` : `${(top*100).toFixed(1)}% of ${basis.replace("-", " ")} is associated with ${measured}.`,
    evidenceIds: projection.evidence.items.map(({ id }) => id), confidence: dimension.confidence, freshness: dimension.freshness,
  });
}

function propertyConcentration(projection: PortfolioProjection, policy = COMPOSITION_CONCENTRATION_POLICY): PortfolioConcentration {
  const values = projection.properties.map((property) => ({ label: property.name, share: property.metrics.grossRevenue === null ? null : projection.performance.grossRevenue ? property.metrics.grossRevenue / projection.performance.grossRevenue : null })).filter((item): item is {label:string;share:number} => item.share !== null).sort((a,b)=>b.share-a.share);
  const top = values[0]?.share ?? null;
  return { id:"concentration:property:revenue", dimension:"property", label:"Property revenue concentration", basis:"revenue", status:concentrationStatus(top,projection.evidence.propertyCoverage,policy), topShare:top, topTwoShare:values.length?values.slice(0,2).reduce((s,v)=>s+v.share,0):null, topThreeShare:values.length?values.slice(0,3).reduce((s,v)=>s+v.share,0):null, measuredItem:values[0]?.label??null, threshold:top===null?null:top>=policy.criticalThreshold?policy.criticalThreshold:top>=policy.highThreshold?policy.highThreshold:top>=policy.moderateThreshold?policy.moderateThreshold:policy.moderateThreshold, statement:top===null?"Property revenue concentration is unavailable.":`${(top*100).toFixed(1)}% of revenue comes from ${values[0].label}.`, evidenceIds:projection.evidence.items.map(({id})=>id), confidence:projection.confidence, freshness:projection.freshness };
}

export function buildDiversificationSummary(projection: PortfolioProjection, dimensions: readonly CompositionDimension[]): DiversificationSummary {
  const count = (type: CompositionDimensionType) => dimensions.find((item) => item.type === type)?.entries.length ?? 0;
  const statements = [`Revenue is distributed across ${projection.properties.length} properties.`, `${count("market")} markets and ${count("operating-model")} operating models are represented.`, `${count("property-type")} property types and ${count("acquisition-strategy")} acquisition strategies are represented.`];
  return { propertyCount:projection.properties.length, marketCount:count("market"), geographyCount:count("geography"), propertyTypeCount:count("property-type"), operatingModelCount:count("operating-model"), acquisitionStrategyCount:count("acquisition-strategy"), independentRevenueSources:count("booking-source"), statements, limited:projection.properties.length<2 };
}

function buildDistribution(projection: PortfolioProjection, markets: CompositionDimension, types: CompositionDimension, models: CompositionDimension, basis: "revenue"|"bookings"): PortfolioDistribution {
  const properties = projection.properties.map((property) => entry(property.name,[property],projection.performance.grossRevenue,projection.performance.bookingCount,projection.properties.length));
  return { basis, byProperty:properties, byMarket:markets.entries, byPropertyType:types.entries, byOperatingModel:models.entries };
}
function buildSeasonality(input: PortfolioCompositionInput): PortfolioSeasonality {
  const totalRevenue=input.seasonality.reduce((s,v)=>s+v.revenue,0); const totalBookings=input.seasonality.reduce((s,v)=>s+v.bookings,0);
  const months=input.seasonality.map((item)=>({...item,label:new Intl.DateTimeFormat("en-US",{month:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2026,item.month-1,1))),revenueShare:totalRevenue?item.revenue/totalRevenue:null,bookingShare:totalBookings?item.bookings/totalBookings:null,occupancy:item.occupancy??null})).sort((a,b)=>a.month-b.month);
  const ranked=[...months].sort((a,b)=>b.revenue-a.revenue).slice(0,COMPOSITION_CONCENTRATION_POLICY.seasonalWindowMonths);
  return { months, peakWindowShare:totalRevenue?ranked.reduce((s,v)=>s+v.revenue,0)/totalRevenue:null, peakWindowLabel:ranked.length?ranked.map(({label})=>label).join(", "):null, coverage:months.length/12 };
}

export function buildPortfolioComposition(query: BuildPortfolioCompositionQuery): PortfolioComposition {
  const types = (["market","geography","property-type","bedrooms","operating-model","acquisition-strategy"] as const).map((type)=>buildCompositionDimension(type,query.projection,query.input));
  const find=(type:CompositionDimensionType)=>types.find((item)=>item.type===type)!;
  const bookingSources=buildBookingSourceDimension(query.projection,query.input);
  const seasonality=buildSeasonality(query.input);
  const dimensions=[...types,bookingSources];
  const concentration=[
    propertyConcentration(query.projection),
    evaluateConcentration(find("market"),"revenue",query.projection),
    evaluateConcentration(find("geography"),"property-count",query.projection),
    evaluateConcentration(find("property-type"),"revenue",query.projection),
    evaluateConcentration(find("operating-model"),"revenue",query.projection),
    evaluateConcentration(find("acquisition-strategy"),"property-count",query.projection),
    evaluateConcentration(bookingSources,"bookings",query.projection),
    { id:"concentration:season:revenue",dimension:"season" as const,label:"Seasonal revenue concentration",basis:"revenue" as const,status:concentrationStatus(seasonality.peakWindowShare,seasonality.coverage),topShare:seasonality.peakWindowShare,topTwoShare:null,topThreeShare:null,measuredItem:seasonality.peakWindowLabel,threshold:seasonality.peakWindowShare===null?null:COMPOSITION_CONCENTRATION_POLICY.moderateThreshold,statement:seasonality.peakWindowShare===null?"Seasonal concentration is unavailable.":`${(seasonality.peakWindowShare*100).toFixed(1)}% of revenue occurs in ${seasonality.peakWindowLabel}.`,evidenceIds:query.projection.evidence.items.map(({id})=>id),confidence:seasonality.coverage>=0.6?query.projection.confidence:ConfidenceLevel.LOW,freshness:query.projection.freshness },
  ];
  const history=query.comparison&&query.comparisonInput?buildHistory(dimensions,(["market","geography","property-type","bedrooms","operating-model","acquisition-strategy"] as const).map((type)=>buildCompositionDimension(type,query.comparison!,query.comparisonInput!)),query.projection,query.comparison):[];
  const scopeType=query.projection.scope.authorization.type;
  const coverage=(type:CompositionDimensionType)=>dimensions.find((item)=>item.type===type)?.coverage??0;
  return Object.freeze({
    identity:query.projection.identity,scope:query.projection.scope,scopeLabel:scopeType==="workspace"?"Full Workspace Portfolio":scopeType==="assigned-properties"?"Your Assigned Portfolio":scopeType==="single-property"?"Single Property Portfolio":"Filtered Portfolio",period:query.projection.period,
    dimensions,markets:find("market"),geography:find("geography"),propertyTypes:find("property-type"),bedrooms:find("bedrooms"),operatingModels:find("operating-model"),acquisitionStrategies:find("acquisition-strategy"),bookingSources,
    revenueDistribution:buildDistribution(query.projection,find("market"),find("property-type"),find("operating-model"),"revenue"),
    bookingDistribution:buildDistribution(query.projection,find("market"),find("property-type"),find("operating-model"),"bookings"),
    seasonality,concentration,diversification:buildDiversificationSummary(query.projection,dimensions),history,
    evidence:{propertyCoverage:query.projection.evidence.propertyCoverage,revenueCoverage:query.projection.properties.length?query.projection.properties.filter(({metrics})=>metrics.grossRevenue!==null).length/query.projection.properties.length:0,bookingCoverage:query.projection.properties.length?query.projection.properties.filter(({evidence})=>evidence.some(({kind})=>kind==="bookings")).length/query.projection.properties.length:0,propertyTypeCoverage:coverage("property-type"),bedroomCoverage:coverage("bedrooms"),operatingModelCoverage:coverage("operating-model"),acquisitionStrategyCoverage:coverage("acquisition-strategy"),bookingSourceCoverage:coverage("booking-source"),limitingDimensions:dimensions.filter(({coverage})=>coverage<1).map(({type})=>type)},
    evaluatedAt:query.projection.generatedAt,confidence:query.projection.confidence,freshness:query.projection.freshness,
  });
}

export const getPortfolioComposition=buildPortfolioComposition;
function entry(label:string,properties:readonly PortfolioPropertyProjection[],totalRevenue:number|null,totalBookings:number,totalProperties:number):CompositionEntry { const revenue=properties.some(({metrics})=>metrics.grossRevenue!==null)?properties.reduce((s,p)=>s+(p.metrics.grossRevenue??0),0):null; const bookings=properties.reduce((s,p)=>s+p.metrics.bookingCount,0); return {key:label.toLowerCase().replaceAll(" ","-"),label,propertyIds:properties.map(({propertyId})=>propertyId),propertyCount:properties.length,propertyShare:totalProperties?properties.length/totalProperties:0,revenue,revenueShare:revenue!==null&&totalRevenue?revenue/totalRevenue:null,bookings,bookingShare:totalBookings?bookings/totalBookings:null}; }
function concentrationStatus(share:number|null,coverage:number,policy=COMPOSITION_CONCENTRATION_POLICY):ConcentrationStatus { if(share===null||coverage<policy.minimumEvidenceCoverage)return"insufficient-evidence"; if(share>=policy.criticalThreshold)return"critical-dependency"; if(share>=policy.highThreshold)return"highly-concentrated"; if(share>=policy.moderateThreshold)return"moderately-concentrated"; return"diversified"; }
function dimensionLabel(type:CompositionDimensionType){return{"market":"Markets","geography":"Geography","property-type":"Property types","bedrooms":"Bedroom mix","operating-model":"Operating models","acquisition-strategy":"Acquisition strategies","booking-source":"Booking sources","season":"Seasonality"}[type];}
function bedroomLabel(value:number|null|undefined){return value===null||value===undefined?null:value>=4?"4+ Bedrooms":`${value} Bedroom${value===1?"":"s"}`;}
function buildHistory(current:readonly CompositionDimension[],previous:readonly CompositionDimension[],projection:PortfolioProjection,comparison:PortfolioProjection){const changes=[];for(const dimension of current){const prior=previous.find(({type})=>type===dimension.type);for(const item of dimension.entries){const old=prior?.entries.find(({key})=>key===item.key);if(!old)changes.push({id:`history:new:${dimension.type}:${item.key}`,type:"new" as const,dimension:dimension.type,label:item.label,currentShare:item.revenueShare??item.propertyShare,propertyIds:item.propertyIds});else if(Math.abs((item.revenueShare??item.propertyShare)-(old.revenueShare??old.propertyShare))>=0.05)changes.push({id:`history:shift:${dimension.type}:${item.key}`,type:"shifted" as const,dimension:dimension.type,label:item.label,previousShare:old.revenueShare??old.propertyShare,currentShare:item.revenueShare??item.propertyShare,propertyIds:item.propertyIds});}for(const item of prior?.entries??[])if(!dimension.entries.some(({key})=>key===item.key))changes.push({id:`history:removed:${dimension.type}:${item.key}`,type:"removed" as const,dimension:dimension.type,label:item.label,previousShare:item.revenueShare??item.propertyShare,propertyIds:item.propertyIds});}for(const propertyId of comparison.scope.propertyIds.filter((id)=>!projection.scope.propertyIds.includes(id))){const archived=comparison.properties.find((property)=>property.propertyId===propertyId)?.status==="archived";changes.push({id:`history:property:${propertyId}`,type:archived?"archived" as const:"removed" as const,dimension:"property" as const,label:archived?"Property archived after the comparison period":"Property removed from current scope",propertyIds:[propertyId]});}return changes;}
