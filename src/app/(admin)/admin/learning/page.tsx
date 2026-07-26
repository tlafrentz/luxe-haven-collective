import Link from "next/link";

import { getLearningAdministrationRequest } from "@/app/actions/learning-governance";
import {
  LearningAdminCard as Card,
  LearningAdminHeader as Header,
} from "@/components/learning/learning-admin-ui";

type Model = Awaited<ReturnType<typeof getLearningAdministrationRequest>>;

export default async function LearningAdministrationPage() {
  let model: Model;

  try {
    model = await getLearningAdministrationRequest();
  } catch {
    return <Denied />;
  }

  return <LearningAdministrationView model={model} />;
}

function LearningAdministrationView({ model }: { model: Model }) {
  const q = model.queues;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
      <Header
        title="Learning Administration"
        detail="Govern knowledge, inspect health, review calibration, and recover safe operational failures without database intervention."
      />

      <nav className="flex flex-wrap gap-2">
        {[
          ["Health", "health"],
          ["Calibration", "calibration"],
          ["Lessons", "lessons"],
          ["Reviews", "reviews"],
          ["Jobs", "jobs"],
          ["Contradictions", "contradictions"],
          ["Governance", "governance"],
        ].map(([label, path]) => (
          <Link
            key={path}
            className="rounded-full border bg-white px-4 py-2 text-sm font-semibold"
            href={`/admin/learning/${path}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Health score" value={`${model.health.score}/100`} />
        <Card label="Pending reviews" value={q.pendingReviews} />
        <Card label="Candidates" value={q.candidateLessons} />
        <Card label="Calibration reviews" value={q.calibrationReviews} />
        <Card label="Contradictions" value={q.contradictions} />
        <Card label="Failed jobs" value={q.failedJobs} />
      </section>

      {model.alerts.length ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
          <h2 className="text-xl font-semibold">Operational alerts</h2>

          <ul className="mt-4 space-y-3">
            {model.alerts.map((alert) => (
              <li key={alert.id} className="rounded-xl bg-white p-4">
                <strong className="capitalize">
                  {alert.severity}: {alert.type.replaceAll("-", " ")}
                </strong>

                <p className="mt-1 text-sm">{alert.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section
          role="status"
          className="rounded-3xl border bg-white p-6"
        >
          <h2 className="text-xl font-semibold">
            No material Learning alerts
          </h2>

          <p className="mt-2 text-sm text-stone-600">
            Current metrics remain within policy thresholds.
          </p>
        </section>
      )}
    </main>
  );
}

function Denied() {
  return (
    <main className="mx-auto max-w-3xl py-12">
      <p
        role="alert"
        className="rounded-2xl border border-rose-200 p-6"
      >
        Learning Administration is unavailable.
      </p>
    </main>
  );
}
