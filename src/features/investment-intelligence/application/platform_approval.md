# ADR-001 — Platform v1 Approved

**Status:** Accepted  
**Date:** July 19, 2026  
**Owner:** CTO OS

---

# Context

Luxe Haven Collective was founded to build the software platform underlying the **Hospitality Performance Management (HPM)** category.

As the product evolved, multiple intelligence engines were developed independently, including:

- Revenue Intelligence
- Market Intelligence
- Investment Intelligence
- Executive Intelligence
- Analytics
- Integrations
- Execution Engine

While each bounded context successfully solved its own domain problem, the platform began exhibiting architectural duplication that would eventually limit scalability.

Examples included:

- Multiple competing lifecycle models
- Duplicate confidence systems
- Multiple scoring implementations
- Feature-to-feature dependencies
- Repeated business vocabulary
- Duplicate Recommendation and Action models
- Domain objects acting as presentation models
- Tight coupling between bounded contexts

Platform Foundation (PF-001 through PF-003) introduced shared platform primitives.

Platform Migration (PM-001 through PM-008) validated those primitives across every major bounded context.

This Architecture Decision Record formally approves Platform v1 as the canonical architectural foundation for Luxe Haven Collective.

---

# Decision

Luxe Haven adopts a layered architecture centered on **canonical Platform artifacts** rather than feature-specific lifecycle models.

The Platform owns lifecycle behavior.

Business domains own hospitality expertise.

Presentation layers consume projections.

External systems communicate exclusively through adapters.

---

# Canonical Lifecycle

Platform v1 defines the canonical lifecycle as:

```text
Observation
    ↓
Evidence
    ↓
Claim
    ↓
Evaluation
    ↓
Recommendation
    ↓
Decision
    ↓
Action
    ↓
Outcome
    ↓
Intelligence
```

Each artifact has one authoritative owner.

No feature may introduce an alternative lifecycle without an approved Architecture Decision Record.

---

# Platform Ownership

The Platform owns:

- Artifact identity
- Lifecycle state
- Lineage
- Traceability
- Shared scoring primitives
- Shared evidence primitives
- Shared decision infrastructure
- Shared action infrastructure
- Shared outcome infrastructure
- Shared intelligence infrastructure

The Platform intentionally does **not** own hospitality-specific business logic.

---

# Feature Ownership

## Revenue Intelligence

Owns:

- Revenue policy
- Pricing strategy
- Occupancy interpretation
- Revenue recommendations
- Revenue evaluation methodology

---

## Market Intelligence

Owns:

- Provider normalization
- Comparable analysis
- Valuation methodology
- Market interpretation
- Demand analysis
- Neighborhood analysis

---

## Investment Intelligence

Owns:

- Underwriting
- Financing analysis
- Scenario analysis
- Acquisition policy
- Investment recommendation methodology

---

## Executive Intelligence

Owns:

- Executive prioritization
- Attention ranking
- Executive briefing
- Portfolio prioritization

---

## Analytics

Owns:

- Historical facts
- Metric calculations
- Time-series aggregation
- Reporting projections
- Dashboard metrics

---

## Integrations

Owns:

- Provider transport
- Synchronization
- Capability registry
- Technical execution
- Provider normalization boundaries

---

## Hospitality Performance Management (HPM)

Owns:

- Cross-capability orchestration
- Performance management
- Improvement-cycle projection
- HPM Score methodology
- Product operating model

---

# Architectural Principles

## Principle 1 — Features Own Expertise

Business logic remains inside the bounded context possessing the domain expertise.

Platform never owns hospitality policy.

---

## Principle 2 — Platform Owns Lifecycle

Lifecycle concepts are shared.

Business concepts are not.

---

## Principle 3 — Adapters Separate Bounded Contexts

Features communicate through explicit adapters.

Feature-to-feature DTO imports are prohibited on canonical paths.

---

## Principle 4 — Read Models Are Projections

Reports, dashboards, and summaries are projections.

They are never canonical domain models.

---

## Principle 5 — Presentation Owns No Business Logic

Presentation consumes projection services.

Business behavior remains below the presentation layer.

---

## Principle 6 — Provider Transport Is Infrastructure

Hospitable.

RentCast.

Supabase.

Future providers.

All remain infrastructure concerns.

Provider DTOs never become domain models.

---

## Principle 7 — Platform Remains Domain-Agnostic

Platform understands:

- Observations
- Evidence
- Claims
- Evaluations
- Recommendations
- Decisions
- Actions
- Outcomes
- Intelligence

Platform does **not** understand:

- ADR
- RevPAR
- Occupancy
- Comparable Properties
- Mortgage Payments
- Hospitality-specific policy

Those belong exclusively to feature domains.

---

# Approved Architectural Pattern

Every major capability follows the same structure:

```text
External Provider
        ↓
Feature Input Adapter
        ↓
Business Policies
        ↓
Canonical Platform Artifacts
        ↓
Projection Adapter
        ↓
Presentation
```

This pattern is mandatory for new platform capabilities.

---

# Platform Layering

```text
                    EXPERIENCE

      Dashboard
      Investment Workspace
      Action Center
      Reports
      Admin

                ↓

      EXECUTIVE ORCHESTRATION

      Executive Attention Policy
      Executive Projection
      Executive Briefing
      Health Projection

                ↓

      CANONICAL PLATFORM

Observation
Evidence
Claim
Evaluation
Recommendation
Decision
Action
Outcome
Intelligence

                ↓

      DOMAIN INTELLIGENCE

Revenue Intelligence
Market Intelligence
Investment Intelligence
Execution Engine

                ↓

      DATA & PROVIDERS

Hospitable
RentCast
Supabase
Analytics
```

---

# HPM Operating Model

Hospitality Performance Management follows the operating lifecycle:

```text
See
Understand
Decide
Execute
Learn
```

Mapped to Platform artifacts:

| HPM Stage | Platform Artifacts |
|------------|--------------------|
| **See** | Observations, Outcomes |
| **Understand** | Evidence, Claims, Evaluations, Intelligence |
| **Decide** | Recommendations, Decisions |
| **Execute** | Actions |
| **Learn** | Outcomes, Intelligence, Learning (future) |

This mapping is canonical for Platform v1.

---

# Approved Integration Pattern

Bounded contexts communicate through canonical Platform artifacts.

```text
Feature
      ↓
Canonical Adapter
      ↓
Platform
      ↓
Projection
      ↓
Presentation
```

Direct feature-to-feature lifecycle coupling is prohibited.

---

# Platform Migration Results

The following migrations successfully validated Platform v1:

| Migration | Status |
|-----------|--------|
| PM-001 — Execution Engine | ✅ Complete |
| PM-002 — Revenue Intelligence | ✅ Complete |
| PM-003 — Market Intelligence | ✅ Complete |
| PM-004 — Investment Intelligence | ✅ Complete |
| PM-005 — Executive Intelligence | ✅ Complete |
| PM-006 — Analytics | ✅ Complete |
| PM-007 — Integrations | ✅ Complete |
| PM-008 — HPM | ✅ Complete |

Architecture validation completed successfully across all major bounded contexts.

---

# Consequences

Platform v1 now provides:

- One canonical lifecycle
- Shared artifact identity
- Shared lineage
- Explainable decision flow
- Stable integration boundaries
- Independent bounded contexts
- Reusable reasoning infrastructure
- Cross-capability orchestration
- Platform-native projections

Future development should focus primarily on **product capabilities**, not additional platform restructuring.

---

# Explicit Non-Goals

Platform v1 does **not** attempt to:

- Replace domain expertise
- Centralize hospitality algorithms
- Standardize provider implementations
- Eliminate bounded contexts
- Introduce AI-specific architecture
- Become a generic workflow engine

These decisions are intentional.

---

# Future Evolution

Platform v1 intentionally leaves room for future capabilities including:

- Platform Learning
- Adaptive recommendation ranking
- Cross-property benchmarking
- Portfolio Intelligence
- AI-assisted Executive prioritization
- Continuous optimization loops
- Autonomous HPM workflows

These capabilities extend Platform v1 rather than replacing it.

---

# Decision Outcome

Platform v1 is approved as the canonical architectural foundation for Luxe Haven Collective.

Future architectural changes affecting:

- Ownership boundaries
- Canonical lifecycle artifacts
- Platform layering
- Dependency rules

require a new Architecture Decision Record.

---

# Milestone

```text
Platform Foundation
PF-001 – PF-003
Completed

Platform Migration
PM-001 – PM-008
Completed

Platform v1
Approved

Hospitality Performance Management
Architecture Validated

July 19, 2026
```# ADR-001 — Platform v1 Approved

**Status:** Accepted  
**Date:** July 19, 2026  
**Owner:** CTO OS

---

# Context

Luxe Haven Collective was founded to build the software platform underlying the **Hospitality Performance Management (HPM)** category.

As the product evolved, multiple intelligence engines were developed independently, including:

- Revenue Intelligence
- Market Intelligence
- Investment Intelligence
- Executive Intelligence
- Analytics
- Integrations
- Execution Engine

While each bounded context successfully solved its own domain problem, the platform began exhibiting architectural duplication that would eventually limit scalability.

Examples included:

- Multiple competing lifecycle models
- Duplicate confidence systems
- Multiple scoring implementations
- Feature-to-feature dependencies
- Repeated business vocabulary
- Duplicate Recommendation and Action models
- Domain objects acting as presentation models
- Tight coupling between bounded contexts

Platform Foundation (PF-001 through PF-003) introduced shared platform primitives.

Platform Migration (PM-001 through PM-008) validated those primitives across every major bounded context.

This Architecture Decision Record formally approves Platform v1 as the canonical architectural foundation for Luxe Haven Collective.

---

# Decision

Luxe Haven adopts a layered architecture centered on **canonical Platform artifacts** rather than feature-specific lifecycle models.

The Platform owns lifecycle behavior.

Business domains own hospitality expertise.

Presentation layers consume projections.

External systems communicate exclusively through adapters.

---

# Canonical Lifecycle

Platform v1 defines the canonical lifecycle as:

```text
Observation
    ↓
Evidence
    ↓
Claim
    ↓
Evaluation
    ↓
Recommendation
    ↓
Decision
    ↓
Action
    ↓
Outcome
    ↓
Intelligence
```

Each artifact has one authoritative owner.

No feature may introduce an alternative lifecycle without an approved Architecture Decision Record.

---

# Platform Ownership

The Platform owns:

- Artifact identity
- Lifecycle state
- Lineage
- Traceability
- Shared scoring primitives
- Shared evidence primitives
- Shared decision infrastructure
- Shared action infrastructure
- Shared outcome infrastructure
- Shared intelligence infrastructure

The Platform intentionally does **not** own hospitality-specific business logic.

---

# Feature Ownership

## Revenue Intelligence

Owns:

- Revenue policy
- Pricing strategy
- Occupancy interpretation
- Revenue recommendations
- Revenue evaluation methodology

---

## Market Intelligence

Owns:

- Provider normalization
- Comparable analysis
- Valuation methodology
- Market interpretation
- Demand analysis
- Neighborhood analysis

---

## Investment Intelligence

Owns:

- Underwriting
- Financing analysis
- Scenario analysis
- Acquisition policy
- Investment recommendation methodology

---

## Executive Intelligence

Owns:

- Executive prioritization
- Attention ranking
- Executive briefing
- Portfolio prioritization

---

## Analytics

Owns:

- Historical facts
- Metric calculations
- Time-series aggregation
- Reporting projections
- Dashboard metrics

---

## Integrations

Owns:

- Provider transport
- Synchronization
- Capability registry
- Technical execution
- Provider normalization boundaries

---

## Hospitality Performance Management (HPM)

Owns:

- Cross-capability orchestration
- Performance management
- Improvement-cycle projection
- HPM Score methodology
- Product operating model

---

# Architectural Principles

## Principle 1 — Features Own Expertise

Business logic remains inside the bounded context possessing the domain expertise.

Platform never owns hospitality policy.

---

## Principle 2 — Platform Owns Lifecycle

Lifecycle concepts are shared.

Business concepts are not.

---

## Principle 3 — Adapters Separate Bounded Contexts

Features communicate through explicit adapters.

Feature-to-feature DTO imports are prohibited on canonical paths.

---

## Principle 4 — Read Models Are Projections

Reports, dashboards, and summaries are projections.

They are never canonical domain models.

---

## Principle 5 — Presentation Owns No Business Logic

Presentation consumes projection services.

Business behavior remains below the presentation layer.

---

## Principle 6 — Provider Transport Is Infrastructure

Hospitable.

RentCast.

Supabase.

Future providers.

All remain infrastructure concerns.

Provider DTOs never become domain models.

---

## Principle 7 — Platform Remains Domain-Agnostic

Platform understands:

- Observations
- Evidence
- Claims
- Evaluations
- Recommendations
- Decisions
- Actions
- Outcomes
- Intelligence

Platform does **not** understand:

- ADR
- RevPAR
- Occupancy
- Comparable Properties
- Mortgage Payments
- Hospitality-specific policy

Those belong exclusively to feature domains.

---

# Approved Architectural Pattern

Every major capability follows the same structure:

```text
External Provider
        ↓
Feature Input Adapter
        ↓
Business Policies
        ↓
Canonical Platform Artifacts
        ↓
Projection Adapter
        ↓
Presentation
```

This pattern is mandatory for new platform capabilities.

---

# Platform Layering

```text
                    EXPERIENCE

      Dashboard
      Investment Workspace
      Action Center
      Reports
      Admin

                ↓

      EXECUTIVE ORCHESTRATION

      Executive Attention Policy
      Executive Projection
      Executive Briefing
      Health Projection

                ↓

      CANONICAL PLATFORM

Observation
Evidence
Claim
Evaluation
Recommendation
Decision
Action
Outcome
Intelligence

                ↓

      DOMAIN INTELLIGENCE

Revenue Intelligence
Market Intelligence
Investment Intelligence
Execution Engine

                ↓

      DATA & PROVIDERS

Hospitable
RentCast
Supabase
Analytics
```

---

# HPM Operating Model

Hospitality Performance Management follows the operating lifecycle:

```text
See
Understand
Decide
Execute
Learn
```

Mapped to Platform artifacts:

| HPM Stage | Platform Artifacts |
|------------|--------------------|
| **See** | Observations, Outcomes |
| **Understand** | Evidence, Claims, Evaluations, Intelligence |
| **Decide** | Recommendations, Decisions |
| **Execute** | Actions |
| **Learn** | Outcomes, Intelligence, Learning (future) |

This mapping is canonical for Platform v1.

---

# Approved Integration Pattern

Bounded contexts communicate through canonical Platform artifacts.

```text
Feature
      ↓
Canonical Adapter
      ↓
Platform
      ↓
Projection
      ↓
Presentation
```

Direct feature-to-feature lifecycle coupling is prohibited.

---

# Platform Migration Results

The following migrations successfully validated Platform v1:

| Migration | Status |
|-----------|--------|
| PM-001 — Execution Engine | ✅ Complete |
| PM-002 — Revenue Intelligence | ✅ Complete |
| PM-003 — Market Intelligence | ✅ Complete |
| PM-004 — Investment Intelligence | ✅ Complete |
| PM-005 — Executive Intelligence | ✅ Complete |
| PM-006 — Analytics | ✅ Complete |
| PM-007 — Integrations | ✅ Complete |
| PM-008 — HPM | ✅ Complete |

Architecture validation completed successfully across all major bounded contexts.

---

# Consequences

Platform v1 now provides:

- One canonical lifecycle
- Shared artifact identity
- Shared lineage
- Explainable decision flow
- Stable integration boundaries
- Independent bounded contexts
- Reusable reasoning infrastructure
- Cross-capability orchestration
- Platform-native projections

Future development should focus primarily on **product capabilities**, not additional platform restructuring.

---

# Explicit Non-Goals

Platform v1 does **not** attempt to:

- Replace domain expertise
- Centralize hospitality algorithms
- Standardize provider implementations
- Eliminate bounded contexts
- Introduce AI-specific architecture
- Become a generic workflow engine

These decisions are intentional.

---

# Future Evolution

Platform v1 intentionally leaves room for future capabilities including:

- Platform Learning
- Adaptive recommendation ranking
- Cross-property benchmarking
- Portfolio Intelligence
- AI-assisted Executive prioritization
- Continuous optimization loops
- Autonomous HPM workflows

These capabilities extend Platform v1 rather than replacing it.

---

# Decision Outcome

Platform v1 is approved as the canonical architectural foundation for Luxe Haven Collective.

Future architectural changes affecting:

- Ownership boundaries
- Canonical lifecycle artifacts
- Platform layering
- Dependency rules

require a new Architecture Decision Record.

---

# Milestone

```text
Platform Foundation
PF-001 – PF-003
Completed

Platform Migration
PM-001 – PM-008
Completed

Platform v1
Approved

Hospitality Performance Management
Architecture Validated

July 19, 2026
```