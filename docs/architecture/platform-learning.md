# Platform Learning Architecture

Platform Learning is a cross-domain relationship capability under `src/platform/learning`.

Feature domains retain semantic ownership:

- Investment Intelligence owns scenarios and investment decisions.
- Revenue Intelligence owns revenue recommendations.
- Financial Intelligence owns budgets, forecasts, and allocations.
- Platform Decisions owns decisions.
- Action Center owns actions.
- Platform Evidence owns source evidence.

Learning stores `LearningSubject` references and typed `LearningLineageEdge` relationships. It never imports feature repositories or rewrites source records.

The existing Platform Learning report and improvement-proposal engine remains intact. PC-001G.1 extends that package with durable subjects, measurement plans, expected and measured outcomes, reviews, assumptions, evidence, lessons, activity, and domain events.

Repositories expose append operations and bounded reads. Supersession creates a new row. Database triggers reject updates and deletes to historical tables. RLS requires active Workspace membership; raw domain-event inspection is restricted to platform administrators.

Domain events are persisted as an outbox-compatible stream:

- `LearningSubjectCreated`
- `OutcomeReviewCreated`
- `LessonCreated`
- `LessonRetired`

Event publication and capability consumers belong to later milestones.
