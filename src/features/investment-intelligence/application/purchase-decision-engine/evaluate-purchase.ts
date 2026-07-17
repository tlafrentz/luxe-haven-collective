import type {
  PurchaseDecisionReport,
  PurchaseInvestmentAnalysis,
} from "../../domain";

import {
  buildPurchaseScenarios,
} from "../build-purchase-scenarios";
import {
  calculatePurchaseFailurePoints,
} from "../calculate-purchase-failure-points";

import {
  buildPurchaseDecisionEvidence,
} from "./builders/build-purchase-decision-evidence";
import {
  buildPurchaseDecisionOpportunities,
} from "./builders/build-purchase-decision-opportunities";
import {
  buildPurchaseDecisionRisks,
} from "./builders/build-purchase-decision-risks";
import {
  buildPurchaseInvestmentRecommendation,
} from "./builders/build-purchase-investment-recommendation";
import {
  buildPurchaseInvestmentThesis,
} from "./builders/build-purchase-investment-thesis";
import {
  calculatePurchaseDecisionConfidence,
} from "./builders/calculate-purchase-decision-confidence";

export function evaluatePurchase(
  analysis: PurchaseInvestmentAnalysis,
): PurchaseDecisionReport {
  const scenarios =
    buildPurchaseScenarios(analysis);
  const failurePoints =
    calculatePurchaseFailurePoints(analysis);

  const evidence =
    buildPurchaseDecisionEvidence({
      analysis,
      scenarios,
      failurePoints,
    });

  const risks = buildPurchaseDecisionRisks({
    analysis,
    scenarios,
    failurePoints,
  });

  const opportunities =
    buildPurchaseDecisionOpportunities({
      analysis,
      scenarios,
      failurePoints,
    });

  const confidence =
    calculatePurchaseDecisionConfidence({
      analysis,
      scenarios,
      failurePoints,
    });

  const thesis =
    buildPurchaseInvestmentThesis({
      analysis,
      evidence,
      risks,
    });

  const recommendation =
    buildPurchaseInvestmentRecommendation({
      analysis,
      scenarios,
      failurePoints,
      evidence,
      risks,
      confidence,
    });

  return {
    thesis,
    evidence,
    risks,
    opportunities,
    confidence,
    recommendation,
    scenarios,
    failurePoints,
  };
}
