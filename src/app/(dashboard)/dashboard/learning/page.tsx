import Link from "next/link";

import { getPlatformLearningWorkspace } from "@/app/actions/platform-learning-workspace";
import {
  ContradictionCard,
  Empty,
  GapCard,
  HealthGrid,
  LearningHeader,
  LessonCard,
  Metric,
  ReviewRow,
} from "@/components/learning/learning-workspace-ui";

type LearningWorkspaceModel = Awaited<
  ReturnType<typeof getPlatformLearningWorkspace>
>;

type LearningDashboardPageProps = Readonly<{
  searchParams: Promise<{
    workspace?: string;
  }>;
}>;

export default async function LearningDashboardPage({
  searchParams,
}: LearningDashboardPageProps) {
  const { workspace } = await searchParams;

  let model: LearningWorkspaceModel;

  try {
    model = await getPlatformLearningWorkspace(workspace);
  } catch {
    return <PermissionState />;
  }

  return <LearningDashboardView model={model} />;
}

function LearningDashboardView({
  model,
}: Readonly<{
  model: LearningWorkspaceModel;
}>) {
  const metrics = model.dashboard.metrics;

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-5 py-10">
      <LearningHeader
        title="Learning Workspace"
        description="Review what happened, understand what your organization has validated, and see where more evidence is needed."
      />

      <section aria-labelledby="learning-summary">
        <div className="flex items-end justify-between">
          <h2
            id="learning-summary"
            className="text-2xl font-semibold"
          >
            Learning summary
          </h2>

          <Link
            href="/dashboard/learning/health"
            className="text-sm font-semibold text-teal-800"
          >
            Health score {model.dashboard.health.score}/100 →
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Reviews completed"
            value={metrics.reviewsCompleted}
          />
          <Metric
            label="Reviews ready"
            value={metrics.reviewsReady}
          />
          <Metric
            label="Validated lessons"
            value={metrics.validatedLessons}
          />
          <Metric
            label="Knowledge gaps"
            value={model.gaps.length}
          />
          <Metric
            label="Reviews overdue"
            value={metrics.reviewsOverdue}
          />
          <Metric
            label="Candidate lessons"
            value={metrics.candidateLessons}
          />
          <Metric
            label="Emerging knowledge"
            value={metrics.emergingKnowledge}
          />
          <Metric
            label="Well validated"
            value={metrics.wellValidatedKnowledge}
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold">
          Knowledge health
        </h2>

        <p className="mt-2 text-sm text-stone-600">
          Confidence and maturity remain separate dimensions.
        </p>

        <div className="mt-5">
          <HealthGrid health={model.dashboard.health} />
        </div>
      </section>

      <section>
        <div className="flex justify-between">
          <h2 className="text-2xl font-semibold">
            Validated knowledge
          </h2>

          <Link
            href="/dashboard/learning/lessons"
            className="text-sm font-semibold text-teal-800"
          >
            Browse knowledge base →
          </Link>
        </div>

        {model.dashboard.recentLessons.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {model.dashboard.recentLessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <Empty
              title="No validated learning yet"
              detail="Complete Outcome Reviews and validate evidence to begin building organizational knowledge."
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold">
          Recent outcome reviews
        </h2>

        {model.dashboard.recentReviews.length ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-4">Review</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Result</th>
                  <th className="p-4">Confidence</th>
                  <th className="p-4">Completed</th>
                </tr>
              </thead>

              <tbody>
                {model.dashboard.recentReviews.map((review) => (
                  <ReviewRow
                    key={review.id}
                    review={review}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5">
            <Empty
              title="No outcome reviews"
              detail="Activate a Measurement Plan to begin measuring decisions and actions."
            />
          </div>
        )}
      </section>

      {model.dashboard.gaps.length ? (
        <section>
          <h2 className="text-2xl font-semibold">
            Knowledge gaps
          </h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {model.dashboard.gaps.map((gap) => (
              <GapCard
                key={gap.id}
                gap={gap}
              />
            ))}
          </div>
        </section>
      ) : null}

      {model.dashboard.contradictions.length ? (
        <section>
          <h2 className="text-2xl font-semibold">
            Contradictions
          </h2>

          <div className="mt-5 space-y-4">
            {model.dashboard.contradictions.map(
              (contradiction) => (
                <ContradictionCard
                  key={contradiction.id}
                  contradiction={contradiction}
                />
              ),
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function PermissionState() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <section
        role="alert"
        className="rounded-3xl border border-stone-200 bg-white p-8"
      >
        <h1 className="text-3xl font-semibold">
          Learning Workspace unavailable
        </h1>

        <p className="mt-3 text-stone-600">
          Sign in with Learning access or choose an authorized
          workspace.
        </p>
      </section>
    </main>
  );
}
