# Revenue Intelligence Architecture

**Status:** Production (Sprint 2)  
**Version:** 1.1.0

---

# Overview

The Revenue Intelligence Engine is the decision-making layer of Luxe Haven Collective.

It transforms raw reservation, revenue, occupancy, payment, and booking data into structured business opportunities that owners and operators can act on.

Unlike a traditional analytics dashboard that simply visualizes metrics, the Revenue Intelligence Engine answers:

- What should I do?
- Why should I do it?
- How much is it worth?
- How confident are we?

This architecture is intentionally deterministic. Every recommendation is generated from explicit business rules rather than AI.

The deterministic engine becomes the trusted source of truth that future AI capabilities will explain—not replace.

---

# Architectural Goals

The engine is designed to:

- Centralize revenue intelligence logic
- Produce explainable recommendations
- Keep business rules independent from the UI
- Support deterministic and future AI-generated insights
- Scale from one property to an entire portfolio
- Enable testing of every business rule independently

---

# High-Level Architecture

```text
Bookings
Properties
Revenue
Payments
Occupancy
        │
        ▼
loadRevenueIntelligenceInputs()
        │
        ▼
calculatePropertyPerformance()
        │
        ▼
Performance Comparison
        │
        ▼
Opportunity Engine
        │
        ├── Payments Detector
        ├── Cancellation Detector
        ├── Gap Night Detector
        ├── Booking Source Detector
        ├── Weekend Pricing Detector
        └── Low Weekday Occupancy Detector
        │
        ▼
Opportunity Report
        │
        ▼
Revenue Intelligence Dashboard
```

---

# Domain Model

The canonical business model is:

```text
RevenueIntelligence
│
├── report
│
├── performance
│
├── opportunityReport
│
├── occupancySeries
│
├── bookings
│
└── metadata
```

Everything else in the application should consume this model.

---

# Opportunity Engine

The Opportunity Engine evaluates a property against a registry of independent detectors.

Each detector answers one business question.

```text
RevenueOpportunityDetector

Input:
    PropertyPerformance

Output:
    RevenueOpportunity[]
```

Detectors never modify application state.

They only describe opportunities.

---

# Detector Registry

Current production detectors:

- Payments Opportunity
- Cancellation Trend
- Booking Source Concentration
- Low Weekday Occupancy
- Gap Night Detection
- Weekend Pricing Opportunity

Each detector is:

- deterministic
- stateless
- independently testable
- composable

---

# Revenue Opportunity

Every opportunity follows the same contract.

```text
RevenueOpportunity

id
type
category
severity
confidence
summary
action
impact
evidence
dateRange
```

This allows the dashboard to display opportunities without knowing which detector created them.

---

# Opportunity Pipeline

```text
Performance
        │
        ▼
Detector Registry
        │
        ▼
All Opportunities
        │
        ▼
Deduplicate
        │
        ▼
Sort
        │
        ▼
Summarize
        │
        ▼
Opportunity Report
```

The pipeline is deterministic and repeatable.

---

# Separation of Responsibilities

## Analytics Feature

Responsible for:

- charts
- KPI cards
- formatting
- date controls
- reporting presentation

Analytics does not make business decisions.

---

## Revenue Intelligence Feature

Responsible for:

- business rules
- opportunity detection
- prioritization
- performance comparison
- orchestration
- future forecasting
- AI integration

Revenue Intelligence owns decision making.

---

# Testing Strategy

Every layer is independently tested.

## Unit Tests

- calculations
- detectors
- comparison logic
- sorting
- deduplication

---

## Service Tests

- performance calculation
- orchestration
- report generation

---

## Dashboard Tests

Presentation components consume immutable domain models.

Business logic is never tested through the UI.

---

# Design Principles

## Deterministic First

Every recommendation must be reproducible.

No recommendation should depend on an LLM.

---

## Explainable

Every opportunity includes:

- evidence
- impact
- confidence
- recommended action

The user should always understand why something was recommended.

---

## Composable

Adding a detector should require:

1. implementing a detector
2. registering it

Nothing else.

---

## UI Agnostic

The engine has no dependency on React.

It can power:

- web dashboards
- PDFs
- scheduled reports
- APIs
- future mobile applications

---

# Future Roadmap

Sprint 3

- Revenue Forecasting
- Occupancy Forecasting
- Dynamic Health Score
- Portfolio Intelligence

Sprint 4

- AI Executive Summary
- AI Pricing Narrative
- AI Monthly Owner Reports

Sprint 5

- Dynamic Pricing Recommendations
- Portfolio Benchmarking
- Market Intelligence
- Competitive Analysis

---

# Long-Term Vision

Revenue Intelligence is the foundation of Luxe Haven Collective's category:

**Hospitality Performance Management**

Rather than functioning as a property management system that happens to include reports, the platform is designed to become an operating system that continuously evaluates hospitality performance and recommends actions that improve revenue, occupancy, operational efficiency, and owner outcomes.

Every future intelligence capability—including forecasting, benchmarking, automation, and AI-generated narratives—will build on the deterministic architecture established in Sprint 2.

---

## Architectural Decision Record

This document represents the implementation of Strategic Decision #001.

**Category**

Hospitality Performance Management

The Revenue Intelligence Engine is the first production implementation of that category and serves as the decision-making layer of the Hospitality Operating System.
