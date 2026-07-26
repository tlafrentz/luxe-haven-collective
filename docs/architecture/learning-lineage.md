# Learning Lineage

Lineage is represented as a graph rather than a feature-owned foreign-key chain.

Each edge contains:

- Workspace and Learning Subject
- typed source and destination references
- source capability
- source identifier and optional version
- relationship type
- creation time

Supported relationships include originated-from, recommended-by, decided-by, executed-by, measured-by, reviewed-by, supported-by, and derived-lesson.

References are identifiers, not copied business objects. This makes the graph capability-independent and keeps feature deployment boundaries intact.

A Lesson cannot exist without evidence references and lineage edges. A completed review cannot exist without evidence. Self-referential edges are rejected. Measurement Plans require at least one expected outcome and a valid time window.

GIN indexes support source-reference and applicability lookup. Subject, review, plan, lesson, activity, and unpublished-event indexes support administrative and future worker access.

History is append-only. Updated reviews, assumption conclusions, measured outcomes, and lessons reference the record they supersede rather than modifying it.
