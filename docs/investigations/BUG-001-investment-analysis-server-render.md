# BUG-001 — Full Investment Analysis Server Render Failure

## Root cause

`analyzeInvestmentWorkspace` returned the canonical
`InvestmentWorkspaceAnalysisResult` directly across the React Server Action
boundary. The exact failing property was:

```text
result.decisionAnalysis.workspaceView.platform
```

That server-only application view contains rich Platform domain objects,
including `ObservationCollection`, `Observation`, `Identifier`,
`ObservationSubject`, `ObservationSource`, and `ObservationProvenance`.
React's Server Components serializer rejects class instances and other
non-plain prototypes.

The permanent spinner was a second defect. The client set the workspace stage
to `resolving-property` before awaiting the action, but did not catch a rejected
Server Action promise. A transport exception therefore bypassed the normal
structured error branch.

## Evidence

The production result graph was generated through
`runInvestmentWorkspaceAnalysis` with the supplied-assumption providers and
recursively inspected.

- `propertyResolution`, `marketReport`, `investmentMarketContext`,
  `investmentAnalysisContext`, and `lifecycleResult` contained no custom
  prototypes.
- Removing `decisionAnalysis.workspaceView` removed every custom prototype.
- `decisionAnalysis.workspaceView.platform.observations` was an
  `ObservationCollection`; its children included the domain classes listed
  above.
- The installed React Server Components serializer throws:

```text
Only plain objects, and a few built-ins, can be passed to Client Components
from Server Components. Classes or null prototypes are not supported.
```

The causal stack is:

```text
analyzeInvestmentWorkspace
  -> runInvestmentWorkspaceAnalysis
  -> getInvestmentDecisionAnalysis
  -> buildInvestmentWorkspaceView
  -> mapInvestmentPlatformAnalysis
  -> React Server Action response serialization
  -> Server Components render error
```

`storeInvestmentAnalysis` completed before the response boundary and serializes
its persistence payload through JSON. It was not the source of the render
failure.

## Reproduction

1. Open the authenticated Investment Workspace.
2. Enter a valid supported property and complete readiness fields.
3. Select **Generate Full Analysis**.
4. Observe that Market and Investment analysis complete server-side.
5. On the affected build, React rejects the action response while serializing
   `decisionAnalysis.workspaceView.platform`.
6. The client promise rejects and the workspace remains in
   `resolving-property`.

## Fix

`projectInvestmentWorkspaceTransport` is now the dedicated transport boundary.
It projects the canonical result to `InvestmentWorkspaceAnalysisTransportDto`
and excludes only the rich, server-only `workspaceView`. The canonical result
is still used for persistence and remains unchanged and deeply immutable.

The client now catches Server Action transport rejection, moves to `error`,
shows an actionable message, and leaves the previous result and assumptions
untouched.

The action records entered, completed, and failed boundary events. Completion
includes payload type and byte size without recording property, user, token, or
analysis contents.

## Regression risk

- A future browser feature must not assume `decisionAnalysis.workspaceView` is
  available; it is explicitly server-only.
- New fields added to the action DTO must remain plain transport values.
- The projection shares immutable canonical subtrees rather than cloning them;
  this is intentional because those subtrees were verified transport-safe.

## Validation

- Purchase lifecycle and transport projection: passed.
- Rental-arbitrage lifecycle and transport prototype scan: passed.
- Ambiguous-property and invalid-input behavior: passed in the relevant suite.
- Full test suite: 513 files, 2,825 tests passed.
- ESLint: passed.
- TypeScript: passed.
- Next.js production build: passed.
- Live production deployment and provider-backed smoke validation: pending
  deployment authorization and production credentials.
