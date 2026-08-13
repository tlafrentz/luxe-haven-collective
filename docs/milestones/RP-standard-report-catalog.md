# Luxe Haven Standard Report Catalog

Catalog version: 1  
Code registry fingerprint: generated deterministically at build and registration time  
Effective date: 2026-08-13

Experience reconciliation found that the new definitions are not yet bound to the existing RP-001 generator and export contracts. The 13 initially registered active v1 definitions are retired; their corrected v2 definitions remain drafts. The five originally deferred definitions remain draft v1. Existing legacy RP-001 reports remain available through their existing definitions.

| Code | Family | Name | Decision | Audience | Subject | Comparisons | Entitlement | Status |
|---|---|---|---|---|---|---|---|---|
| EXEC-PERFORMANCE | Executive | Executive Performance Report | Where is performance strong or weak? | Portfolio owner, executive operator, administrator | Portfolio | Prior period/year, target | HPM Growth or executive-report grant | Draft v2 |
| EXEC-PORTFOLIO | Executive | Portfolio Performance Report | Which properties require attention? | Portfolio owner, executive operator, administrator | Portfolio | Prior period/year, target, portfolio benchmark | HPM Growth or executive-report grant | Draft v2 |
| EXEC-DECISIONS | Executive | Decisions & Actions Report | What has been decided and executed? | Portfolio owner, executive operator, administrator | Action portfolio | None, prior period | HPM Growth or executive-report grant | Draft v2 |
| EXEC-OUTCOMES | Executive | Outcomes & Learning Report | What actions produced measurable results? | Portfolio owner, executive operator, administrator | Action portfolio | Prior period, target | HPM Growth or executive-report grant | Draft |
| OWNER-PERFORMANCE | Owner | Property Performance Report | How did my property perform? | Property owner, representative, portfolio operator | Property | Prior period/year, target | Active HPM + authorized property | Draft v2 |
| OWNER-REVENUE | Owner | Revenue Performance Report | What drove revenue and pricing results? | Property owner, representative, portfolio operator | Property | Prior period/year, target | Active HPM + authorized property | Draft v2 |
| OWNER-HEALTH | Owner | Property Health Report | What needs improvement? | Property owner, representative, portfolio operator | Property | Prior period, target | Active HPM + authorized property | Draft v2 |
| OWNER-ACTIVITY | Owner | Decisions & Activity Report | What has Luxe Haven done or recommended? | Property owner, representative, portfolio operator | Property | None, prior period | Active HPM + authorized property | Draft v2 |
| OWNER-STATEMENT | Owner | Owner Financial Statement | What is my distributable financial result? | Property owner, representative, portfolio operator | Property | Prior period/year | Active HPM + authorized property | Draft |
| INV-ANALYSIS | Investment | Investment Analysis Report | Should I pursue this opportunity? | Investor, analyst, advisor | Opportunity | Snapshot | Investment entitlement + opportunity access | Draft v2 |
| INV-COMPARISON | Investment | Opportunity Comparison Report | Which opportunity is strongest? | Investor, analyst, advisor | Opportunity | Snapshot | Investment entitlement + opportunity access | Draft v2 |
| INV-DILIGENCE | Investment | Investment Due Diligence Report | What must be validated before proceeding? | Investor, analyst, advisor | Opportunity | Snapshot | Investment entitlement + opportunity access | Draft v2 |
| INV-PERFORMANCE | Investment | Actual vs. Underwriting Report | Is the investment meeting expectations? | Investor, analyst, advisor | Opportunity | Underwriting | Investment entitlement + opportunity access | Draft |
| OPS-ATTENTION | Operations | Operations Attention Report | What requires action now? | Operator, property manager, operations staff | Action portfolio | None, prior period | Active HPM + operations role | Draft v2 |
| OPS-ACTIONS | Operations | Action Execution Report | Is work progressing correctly? | Operator, property manager, operations staff | Action portfolio | Prior period, target | Active HPM + operations role | Draft v2 |
| OPS-QUALITY | Operations | Property Quality Report | Where is service quality at risk? | Operator, property manager, operations staff | Property | Prior period, target | Active HPM + operations role | Draft v2 |
| OPS-TURNOVER | Operations | Turnover Performance Report | Are turnovers timely and complete? | Operator, property manager, operations staff | Property | Prior period, target | Active HPM + operations role | Draft |
| OPS-MAINTENANCE | Operations | Maintenance Performance Report | What maintenance risk is emerging? | Operator, property manager, operations staff | Property | Prior period, target | Active HPM + operations role | Draft |

## Contract detail

The complete ordered section lists, required and conditional input mappings, missing-data behavior, formats, destination codes, and exact policy codes are held in `STANDARD_REPORT_DEFINITIONS`. This document is the customer- and operator-readable catalog; the immutable code definition is the registration authority.

Investment disclosures distinguish customer assumptions, provider observations, platform calculations, and manual fallback inputs, and state that diligence output is not legal, tax, appraisal, inspection, or investment advice. Property Health consumes the canonical HPM health projection and creates no competing score. Property Quality renders review, inspection, turnover, Guidebook, amenity, or furnishing content only where an authorized canonical source exists.
