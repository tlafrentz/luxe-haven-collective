import {
  PropertyIntelligence,
  type PropertyValuationRange,
} from "../../domain/entities/property-intelligence";
import { PropertyRecord } from "../../domain/entities/property-record";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { MarketScore } from "../../domain/value-objects/market-score";

export interface BuildPropertyIntelligenceInput {
  readonly property: PropertyRecord;
  readonly valuation?: PropertyValuationRange;
  readonly propertyScore: number;
  readonly confidenceScore: number;
}

export function buildPropertyIntelligence(
  input: BuildPropertyIntelligenceInput,
): PropertyIntelligence {
  const { property, valuation, propertyScore, confidenceScore } = input;
  const missingInformation = buildMissingInformation(property);
  const estimatedValue =
    valuation?.estimated ?? property.financialFacts.estimatedValue;

  return PropertyIntelligence.create({
    propertyId: property.id,
    propertyType:
      property.characteristics.propertyType?.trim() || "unknown",
    bedrooms: property.characteristics.bedrooms,
    bathrooms: property.characteristics.bathrooms,
    squareFeet: property.characteristics.squareFeet,
    yearBuilt: property.characteristics.yearBuilt,
    valuation,
    estimatedPricePerSquareFoot: calculatePricePerSquareFoot(
      estimatedValue,
      property.characteristics.squareFeet,
    ),
    propertyScore: MarketScore.create(propertyScore),
    confidence: new ConfidenceScore(confidenceScore),
    strengths: buildStrengths(property, valuation),
    weaknesses: buildWeaknesses(property, valuation),
    knownFacts: buildKnownFacts(property),
    missingInformation,
    executiveSummary: buildExecutiveSummary(
      property,
      valuation,
      missingInformation,
    ),
  });
}

function buildKnownFacts(property: PropertyRecord): readonly string[] {
  const facts: string[] = [`Address: ${property.address.formatted}`];
  const characteristics = property.characteristics;
  const financialFacts = property.financialFacts;

  if (characteristics.propertyType) {
    facts.push(`Property type: ${characteristics.propertyType}`);
  }
  if (characteristics.bedrooms !== undefined) {
    facts.push(`Bedrooms: ${characteristics.bedrooms}`);
  }
  if (characteristics.bathrooms !== undefined) {
    facts.push(`Bathrooms: ${characteristics.bathrooms}`);
  }
  if (characteristics.squareFeet !== undefined) {
    facts.push(`Living area: ${characteristics.squareFeet} square feet`);
  }
  if (characteristics.lotSquareFeet !== undefined) {
    facts.push(`Lot area: ${characteristics.lotSquareFeet} square feet`);
  }
  if (characteristics.yearBuilt !== undefined) {
    facts.push(`Year built: ${characteristics.yearBuilt}`);
  }
  if (financialFacts.estimatedValue !== undefined) {
    facts.push(
      `Provider estimated value: ${formatCurrency(
        financialFacts.estimatedValue,
      )}`,
    );
  }
  if (financialFacts.annualPropertyTaxes !== undefined) {
    facts.push(
      `Annual property taxes: ${formatCurrency(
        financialFacts.annualPropertyTaxes,
      )}`,
    );
  }
  if (financialFacts.lastSalePrice !== undefined) {
    facts.push(
      `Last sale price: ${formatCurrency(financialFacts.lastSalePrice)}`,
    );
  }

  return facts;
}

function buildMissingInformation(
  property: PropertyRecord,
): readonly string[] {
  const missing: string[] = [];
  const characteristics = property.characteristics;

  if (!characteristics.propertyType?.trim()) {
    missing.push("Property type");
  }
  if (characteristics.bedrooms === undefined) {
    missing.push("Bedroom count");
  }
  if (characteristics.bathrooms === undefined) {
    missing.push("Bathroom count");
  }
  if (characteristics.squareFeet === undefined) {
    missing.push("Living area");
  }
  if (characteristics.yearBuilt === undefined) {
    missing.push("Year built");
  }
  if (!property.coordinates) {
    missing.push("Geographic coordinates");
  }

  return missing;
}

function buildStrengths(
  property: PropertyRecord,
  valuation?: PropertyValuationRange,
): readonly string[] {
  const strengths: string[] = [];

  if (property.hasCoordinates) {
    strengths.push("Property location is geocoded.");
  }
  if (property.hasPropertyFacts) {
    strengths.push("Core physical property facts are available.");
  }
  if (property.hasFinancialFacts || valuation) {
    strengths.push("Property valuation evidence is available.");
  }

  return strengths;
}

function buildWeaknesses(
  property: PropertyRecord,
  valuation?: PropertyValuationRange,
): readonly string[] {
  const weaknesses: string[] = [];

  if (!property.hasPropertyFacts) {
    weaknesses.push("Core physical property facts are incomplete.");
  }
  if (!property.hasFinancialFacts && !valuation) {
    weaknesses.push("No property valuation evidence is available.");
  }

  return weaknesses;
}

function buildExecutiveSummary(
  property: PropertyRecord,
  valuation: PropertyValuationRange | undefined,
  missingInformation: readonly string[],
): string {
  const profileStatement =
    missingInformation.length === 0
      ? "The property profile is complete"
      : `The property profile has ${missingInformation.length} material data ${
          missingInformation.length === 1 ? "gap" : "gaps"
        }`;

  const estimatedValue =
    valuation?.estimated ?? property.financialFacts.estimatedValue;

  const valuationStatement =
    estimatedValue === undefined
      ? "No valuation conclusion is currently available."
      : `The current estimated value is ${formatCurrency(estimatedValue)}.`;

  return `${profileStatement}. ${valuationStatement}`;
}

function calculatePricePerSquareFoot(
  estimatedValue: number | undefined,
  squareFeet: number | undefined,
): number | undefined {
  if (
    estimatedValue === undefined ||
    squareFeet === undefined ||
    squareFeet <= 0
  ) {
    return undefined;
  }

  return round(estimatedValue / squareFeet, 2);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
