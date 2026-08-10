# AU-001C Governed Execution

AU-001C consumes immutable AU-001B run requests and owns orchestration facts only. It does not mutate Execute, Decide, Learn, Recommendation, provider, or policy persistence. Every business effect crosses a registered owning-capability command port and is reauthorized immediately before dispatch.

## Contract inventory

- `AutomationExecutionPlan` (`au001-execution-plan.v1`) is bounded, deterministic, schema-validated, and acyclic.
- `AutomationRun` is unique by AU-001B `runRequestId` and binds the definition version, trigger occurrence, execution-plan version, actors, correlation, and causation.
- `AutomationRunStep` has stable step, command, and idempotency identities. Attempts never create a new logical business identity.
- `AutomationPolicyDecision` fails closed for prohibited, unavailable, conflicting, or insufficient policy.
- `AutomationApproval` is scoped to the definition, command fingerprint, target context, policy version, and expiry.
- `AutomationCommandPort` separates pre-dispatch authorization, dispatch, status reconciliation, cancellation, and compensation from AU orchestration.
- `AutomationCommandEnvelope` carries expected version, actors, approval reference, identity, deadlines, and safe provenance.

## Transaction and recovery boundary

Run materialization is atomic with its steps and activity. Policy state, activity, and notification intents are atomic. External dispatch is deliberately outside the database transaction. Owning command identity and idempotency allow a lost acknowledgement to enter reconciliation rather than blind retry. Unknown acceptance is never classified as failure or success.

Append-only attempts, approval dispositions, policy decisions, and activity preserve history. Cancellation stops future work but cannot erase completed effects. Compensation is possible only through an explicit owning-capability command and never through inverse SQL.

## Legacy compatibility

The older generic `AutomationExecutor` remains compatible for existing callers but is not used by AU-001C. It directly invokes Action/Workflow objects and therefore cannot satisfy AU-001C authority, approval, lease, command-port, or reconciliation rules. No existing behavior was rewritten.

## Production safety

`createProductionGovernedExecution` registers no route, worker, cron, subscriber, or dispatch loop. Foundation, governed-execution, and dispatch flags must all be enabled and the global kill switch must be off. The automation service actor must be active and carry explicit tenant/property/capability/command grants. HPM-001F and AU-001F remain rollout gates.
