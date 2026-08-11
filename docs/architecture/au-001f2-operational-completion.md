# AU-001F.2 operational completion

Status: implementation in progress; production dispatch and rollout remain prohibited.

## First supported owning-capability adapter

Execute `createDraftPlan` contract `v1` is the only supported automation command adapter. Its boundary may create an authorized draft action plan only. It cannot activate a plan, create active actions, assign work, approve a decision, or execute an external effect.

The adapter:

- accepts only `action-plan-draft` targets with an explicit non-empty property scope;
- validates the immutable command type and contract version;
- maps only safe title, description, priority, lineage, actor, and idempotency fields;
- delegates authorization, persistence, command-status lookup, and idempotency to Execute;
- returns stable governed-execution classifications;
- remains production-disabled until a least-privilege Execute service identity and boundary are composed and verified.

Decide, Outcome Measurement, Learning, Recommendations, and Furnishing are registered as explicitly unsupported. Their ports reject authorization with `COMMAND_CONTRACT_UNSUPPORTED` and return `unsupported` if invoked directly. Missing support can therefore never be inferred from a generic adapter or UI state.

## Operational readiness contract

`evaluateAutomationOperationalReadiness` fails closed unless all of the following are supplied as environment evidence:

- HTTPS health, queue, incident, and delivery dashboards;
- the versioned AU health/alert threshold policy;
- named release, operations, security, and database owners with escalation targets;
- an alert channel and destination;
- a successful alert-delivery verification identifier and timestamp.

Placeholder tests demonstrate the contract but do not constitute real provider configuration. Provider dashboard URLs, named people, routing destinations, and delivery receipts must be recorded from the approved environment before this gate passes.

## Remaining manual or environment gates

- configure and test the least-privilege Execute automation service actor;
- verify Execute draft creation idempotency and denial through authenticated hosted clients;
- configure provider dashboards and deliver a synthetic alert to the named on-call route;
- run broader authenticated non-AU journeys against the migrated hosted environment;
- complete keyboard, screen-reader, zoom/reflow, focus, and mobile accessibility checks;
- perform and time non-production application artifact rollback and forward recovery;
- complete HPM-001F stabilization and obtain authorized approval.

No item above can be marked passed solely from unit tests. AU-001F.3 remains blocked.

