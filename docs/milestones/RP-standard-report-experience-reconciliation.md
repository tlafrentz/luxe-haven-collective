# Standard Report Definition-to-Experience Reconciliation

Reconciled: 2026-08-13  
Catalog action: all 13 previously active v1 definitions retired; replacement v2 definitions remain draft. The five originally deferred definitions remain draft v1.

## Result

No new standard definition is fully operational under its exact contract. RP-001 has a functioning older canonical generation and export pipeline, but it recognizes only five older definition identifiers plus Custom. The generic generation route obtains its choices from that older registry. The new report codes therefore cannot be submitted to the generator. Production Investment source loading explicitly returns `CANONICAL_SOURCE_UNAVAILABLE`. Exports support PDF, CSV, and CSV-ZIP; literal ZIP is not an independently supported request format.

The safe outcome is to advertise none of the new definitions until exact experience bindings exist. Existing RP-001 reports remain available under their existing definitions and authorization policies.

## Per-report classification

| Definition | Classification | Evidence and precise gap | Catalog outcome |
|---|---|---|---|
| EXEC-PERFORMANCE | Operational with a content gap | Legacy Executive Performance Brief generates, but the new code and full revenue/decision section contract are not bound. | v1 retired; v2 draft |
| EXEC-PORTFOLIO | Operational with a content gap | HPM portfolio report exists, but the new property ranking, variance, decision/action section contract is not bound. | v1 retired; v2 draft |
| EXEC-DECISIONS | Operational with a content gap | HPM decision/outcome traceability exists; exact period decision/action/evidence contract is not bound. | v1 retired; v2 draft |
| OWNER-PERFORMANCE | Operational with a content gap | Legacy Owner Performance Report generates; the new code and complete booking/channel contract are not bound. | v1 retired; v2 draft |
| OWNER-REVENUE | Missing experience wiring | No registered RP-001 definition/provider assembles this section contract. | v1 retired; v2 draft |
| OWNER-HEALTH | Operational with a content gap | HPM property lifecycle reports exist, but no exact owner-safe canonical HPM-health report binding exists. | v1 retired; v2 draft |
| OWNER-ACTIVITY | Operational with a content gap | Decision/action projections exist, but no owner-safe report binding for the exact contract exists. | v1 retired; v2 draft |
| INV-ANALYSIS | Incorrectly active | Legacy definition exists, but production source deliberately returns unavailable canonical metrics. | v1 retired; v2 draft |
| INV-COMPARISON | Incorrectly active | Legacy definition exists, but production comparison source deliberately returns unavailable canonical metrics. | v1 retired; v2 draft |
| INV-DILIGENCE | Missing experience wiring | No RP-001 definition, canonical provider, or form route exists for this contract. | v1 retired; v2 draft |
| OPS-ATTENTION | Operational with a content gap | HPM execution/blocker report exists; exact assignment, due-date, evidence and escalation contract is not bound. | v1 retired; v2 draft |
| OPS-ACTIONS | Operational with a content gap | Canonical decisions/actions exist, but the requested action-execution report contract is not registered. | v1 retired; v2 draft |
| OPS-QUALITY | Missing experience wiring | Canonical review/inspection/turnover quality sources are incomplete and no exact report binding exists. | v1 retired; v2 draft |

## Format reconciliation

- Web: generic RP-001 routes render immutable legacy report versions only.
- PDF: generated from the same immutable RP-001 snapshot.
- CSV: generated from the same immutable snapshot for eligible tabular sections.
- ZIP: RP-001 currently creates `csv_zip` only when multiple CSV datasets exist. It does not provide the broader catalog ZIP contract.

## Authorization and readiness

Existing RP-001 generation reauthorizes workspace membership, scope, property access, permissions, and immutable Investment analysis versions. The new catalog’s entitlement rules are not connected to that generation authorization. Its separate readiness evaluator is likewise not invoked by the RP-001 generator. Keeping every replacement definition in draft prevents catalog visibility from implying generation access and prevents a page visit or partial projection from manufacturing readiness.

## Deferred definitions

These remain draft v1 exactly as required:

- Executive Outcomes & Learning
- Owner Financial Statement
- Investment Actual vs. Underwriting
- Turnover Performance
- Maintenance Performance
