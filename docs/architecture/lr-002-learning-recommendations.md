# LR-002 Learning Recommendations

LR-002 extends Platform Recommendations with governed, contextual proposals sourced from current approved Learning. Lessons, recommendations, decisions, action plans, actions, policies, templates, and measurements remain separate aggregates.

## Safety boundary

- Recommendations consume the structural LR-001 approved-learning contract; they do not query Learning tables directly.
- Applicability is versioned against both the exact lesson version and target-context version.
- Recommendation confidence is capped by lesson confidence, evidence strength, applicability, and target data quality.
- Property-specific lessons applied elsewhere are framed as investigations or experiments, never established portfolio guidance.
- Acceptance authorizes only an explicit handoff request. Decide, Execute, template, policy, and EX-002 services validate and own all downstream mutations.
- Downstream results return through EX-002 and LR-001 before they may support another recommendation. No autonomous recommendation loop exists.

## Persistence and rollout

Recommendation opportunities, versions, source links, applicability assessments, relationships, handoff references, and activity are append-oriented. RLS requires workspace membership and access to every property represented in the target scope.

The migration remains local until application repositories, composition, downstream command adapters, and non-production PostgreSQL RLS tests are complete.
