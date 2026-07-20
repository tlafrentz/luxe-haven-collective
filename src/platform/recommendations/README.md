# Luxe Haven Platform Recommendations

Recommendations is the canonical platform capability for transforming completed
Evaluations into proposed actions.

```text
Observation → Evidence → Claim → Evaluation → Recommendation → Decision
```

A Recommendation answers: **Given everything we know, what should happen
next?** It preserves the supporting Evaluation identities, supporting Evidence,
and canonical confidence assessment while adding an action summary, rationale,
feature-owned category, and platform priority.

## Ownership boundaries

The domain owns immutable Recommendations and query-only collections. Policies
own feature reasoning. The builder validates and normalizes policy output. The
registry owns policy discovery. The executor owns orchestration and returns an
immutable session using the Platform Execution status, statistics, and
diagnostics contracts.

Recommendations propose actions; they do not select them. Selection belongs to
the Decisions capability. This capability contains no workflow automation,
side effects, UI concerns, or hospitality-specific policies.

## Execution

```ts
const session = await new RecommendationExecutor().execute({
  evaluations,
  registry,
});

const recommendations = session.recommendations;
```

Each applicable policy runs against the completed `EvaluationCollection`.
Unsupported policies are skipped, a policy may intentionally produce no
recommendation, and policy failures are recorded without preventing remaining
policies from executing.

When exactly one Evaluation supports a Recommendation, the builder inherits
its confidence. Policies synthesizing multiple Evaluations must explicitly
provide confidence. Supporting Evidence is derived from supporting Evaluations
unless the policy supplies a narrower set.
