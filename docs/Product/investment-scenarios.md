# Investment Scenarios

Every Investment Opportunity exposes a Scenario workspace at `/dashboard/investments/opportunities/[id]/scenarios`.

Calculated scenarios are immutable Opportunity Analysis snapshots. Each preserves route-specific assumptions, financial results, evidence, risks, score, recommendation, confidence, policy versions, engine identity, lineage, and capture time. Generating changed assumptions saves a new revision rather than rewriting history.

The workspace supports two-to-four-scenario comparison, preferred-scenario identification, changed-assumptions-only review, directional financial differences, historical detail, and duplication into the Investment Decision Analysis workflow.

The current Opportunity analysis is the preferred scenario and therefore remains the default decision context for Opportunity summaries and downstream reports.
